import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseHealthInfo, DatabaseService } from '../database/database.service.js';

export class DatabaseHealthDto {
  status: string;
  ready: boolean;
  databaseName?: string;
  host?: string;
}

export class HealthCheckResponseDto {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
  uptime: number;
  database: DatabaseHealthDto;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  check(): HealthCheckResponseDto {
    const dbInfo: DatabaseHealthInfo = this.databaseService.getHealthInfo();

    return {
      status: 'ok',
      service: 'ar-dine-backend',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: {
        status: dbInfo.status,
        ready: dbInfo.ready,
        databaseName: dbInfo.databaseName,
        host: dbInfo.host,
      },
    };
  }
}
