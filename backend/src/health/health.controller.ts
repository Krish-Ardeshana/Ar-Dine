import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthCheckResponseDto, HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  getHealth(): HealthCheckResponseDto {
    return this.healthService.check();
  }
}
