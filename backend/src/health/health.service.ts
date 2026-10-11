import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class HealthCheckResponseDto {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService {
  constructor(private readonly configService: ConfigService) {}

  check(): HealthCheckResponseDto {
    return {
      status: 'ok',
      service: 'ar-dine-backend',
      environment: this.configService.get<string>('NODE_ENV', 'development'),
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
