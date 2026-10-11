import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import mongoose from 'mongoose';

export type DatabaseStatus =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected';

export interface DatabaseHealthInfo {
  status: DatabaseStatus;
  ready: boolean;
  databaseName?: string;
  host?: string;
}

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    @InjectConnection() private readonly connection: mongoose.Connection,
  ) {
    const rawUri = this.configService.get<string>('MONGODB_URI');
    this.isConfigured = Boolean(rawUri && rawUri.trim().length > 0);

    if (!this.isConfigured) {
      this.logger.warn(
        'MONGODB_URI is not set. Database integration is in UNCONFIGURED mode. Database operations will be inactive.',
      );
    } else {
      this.logger.log(
        `Database module initialized with sanitized target: ${this.getSanitizedTarget(rawUri!)}`,
      );
      this.setupConnectionListeners();
    }
  }

  private setupConnectionListeners(): void {
    this.connection.on('connected', () => {
      this.logger.log(`MongoDB connection established on host: ${this.connection.host}`);
    });

    this.connection.on('disconnected', () => {
      this.logger.warn('MongoDB connection disconnected');
    });

    this.connection.on('error', (error: Error) => {
      this.logger.error(`MongoDB connection error: ${error.message}`);
    });
  }

  private getSanitizedTarget(uri: string): string {
    try {
      const parsed = new URL(uri);
      const auth = parsed.username ? '***:***@' : '';
      return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
    } catch {
      return uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    }
  }

  getHealthInfo(): DatabaseHealthInfo {
    if (!this.isConfigured) {
      return {
        status: 'unconfigured',
        ready: false,
      };
    }

    const state = this.connection.readyState;
    let status: DatabaseStatus = 'disconnected';

    switch (state) {
      case 1:
        status = 'connected';
        break;
      case 2:
        status = 'connecting';
        break;
      case 3:
        status = 'disconnecting';
        break;
      default:
        status = 'disconnected';
        break;
    }

    return {
      status,
      ready: status === 'connected',
      ...(status === 'connected'
        ? {
            databaseName: this.connection.name,
            host: this.connection.host,
          }
        : {}),
    };
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.connection && this.connection.readyState === 1) {
      this.logger.log(`Closing MongoDB connection gracefully on signal: ${signal}`);
      await this.connection.close();
    }
  }
}
