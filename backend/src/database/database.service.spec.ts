import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  let mockConfigService: any;
  let mockConnection: any;

  beforeEach(() => {
    mockConfigService = {
      get: vi.fn(),
    };
    mockConnection = {
      readyState: 0,
      name: 'ar_dine_test',
      host: 'cluster0.mongodb.net',
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('Unconfigured Scaffolding Mode', () => {
    it('should report unconfigured status and ready:false when MONGODB_URI is undefined', () => {
      mockConfigService.get.mockReturnValue(undefined);
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const health = service.getHealthInfo();
      expect(health.status).toBe('unconfigured');
      expect(health.ready).toBe(false);
      expect(health.databaseName).toBeUndefined();
    });

    it('should report unconfigured status when MONGODB_URI is blank whitespace', () => {
      mockConfigService.get.mockReturnValue('   ');
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const health = service.getHealthInfo();
      expect(health.status).toBe('unconfigured');
      expect(health.ready).toBe(false);
    });
  });

  describe('Configured Database Health & Ready States', () => {
    it('should report connected with database details when readyState is 1', () => {
      mockConfigService.get.mockReturnValue('mongodb://127.0.0.1:27017/ar_dine');
      mockConnection.readyState = 1;
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const health = service.getHealthInfo();
      expect(health.status).toBe('connected');
      expect(health.ready).toBe(true);
      expect(health.databaseName).toBe('ar_dine_test');
      expect(health.host).toBe('cluster0.mongodb.net');
    });

    it('should report connecting and ready:false when readyState is 2', () => {
      mockConfigService.get.mockReturnValue('mongodb://127.0.0.1:27017/ar_dine');
      mockConnection.readyState = 2;
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const health = service.getHealthInfo();
      expect(health.status).toBe('connecting');
      expect(health.ready).toBe(false);
    });

    it('should report disconnecting and ready:false when readyState is 3', () => {
      mockConfigService.get.mockReturnValue('mongodb://127.0.0.1:27017/ar_dine');
      mockConnection.readyState = 3;
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const health = service.getHealthInfo();
      expect(health.status).toBe('disconnecting');
      expect(health.ready).toBe(false);
    });

    it('should report disconnected and ready:false when readyState is 0', () => {
      mockConfigService.get.mockReturnValue('mongodb://127.0.0.1:27017/ar_dine');
      mockConnection.readyState = 0;
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const health = service.getHealthInfo();
      expect(health.status).toBe('disconnected');
      expect(health.ready).toBe(false);
    });
  });

  describe('Sanitized Target Logging (Credential Protection)', () => {
    it('should redact credentials in MongoDB Atlas srv URI', () => {
      mockConfigService.get.mockReturnValue('mongodb+srv://admin_user:super_secret_password@cluster0.mongodb.net/ar_dine');
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const sanitized = (service as any).getSanitizedTarget(
        'mongodb+srv://admin_user:super_secret_password@cluster0.mongodb.net/ar_dine',
      );
      expect(sanitized).not.toContain('admin_user');
      expect(sanitized).not.toContain('super_secret_password');
      expect(sanitized).toContain('***:***@');
      expect(sanitized).toContain('cluster0.mongodb.net/ar_dine');
    });

    it('should redact credentials in standard MongoDB URI with port', () => {
      mockConfigService.get.mockReturnValue('mongodb://db_admin:pass12345@127.0.0.1:27017/ar_dine');
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      const sanitized = (service as any).getSanitizedTarget(
        'mongodb://db_admin:pass12345@127.0.0.1:27017/ar_dine',
      );
      expect(sanitized).not.toContain('db_admin');
      expect(sanitized).not.toContain('pass12345');
      expect(sanitized).toContain('***:***@');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close active MongoDB connection on application shutdown signal', async () => {
      mockConfigService.get.mockReturnValue('mongodb://127.0.0.1:27017/ar_dine');
      mockConnection.readyState = 1;
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      await service.onApplicationShutdown('SIGTERM');
      expect(mockConnection.close).toHaveBeenCalledTimes(1);
    });

    it('should not attempt to close connection when already disconnected', async () => {
      mockConfigService.get.mockReturnValue('mongodb://127.0.0.1:27017/ar_dine');
      mockConnection.readyState = 0;
      const service = new DatabaseService(mockConfigService as ConfigService, mockConnection);

      await service.onApplicationShutdown('SIGTERM');
      expect(mockConnection.close).not.toHaveBeenCalled();
    });
  });
});
