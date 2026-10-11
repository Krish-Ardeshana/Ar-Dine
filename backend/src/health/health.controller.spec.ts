import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
import { DatabaseService } from '../database/database.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: string) => {
              if (key === 'NODE_ENV') return 'test';
              return defaultValue;
            }),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            getHealthInfo: vi.fn().mockReturnValue({
              status: 'unconfigured',
              ready: false,
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status with database info', () => {
    const result = controller.getHealth();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('ar-dine-backend');
    expect(result.environment).toBe('test');
    expect(typeof result.timestamp).toBe('string');
    expect(typeof result.uptime).toBe('number');
    expect(result.database).toEqual({
      status: 'unconfigured',
      ready: false,
    });
  });
});
