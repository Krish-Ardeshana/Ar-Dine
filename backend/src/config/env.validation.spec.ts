import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Environment, validate } from './env.validation.js';

describe('Environment Validation (env.validation)', () => {
  const validAccessSecret = 'a'.repeat(32);
  const validRefreshSecret = 'b'.repeat(32);

  describe('Development & Default Environment', () => {
    it('should provide sensible defaults when empty config is passed', () => {
      const config = validate({});
      expect(config.NODE_ENV).toBe(Environment.Development);
      expect(config.PORT).toBe(4000);
      expect(config.CORS_ORIGIN).toBe('http://localhost:3000');
      expect(config.FRONTEND_BASE_URL).toBe('http://localhost:3000');
      expect(config.STORAGE_DIR).toBe('./storage');
      expect(config.JWT_ACCESS_EXPIRES_IN).toBe('15m');
      expect(config.JWT_REFRESH_EXPIRES_IN).toBe('7d');
    });

    it('should parse string PORT into a numeric value', () => {
      const config = validate({ PORT: '5001' });
      expect(config.PORT).toBe(5001);
      expect(typeof config.PORT).toBe('number');
    });

    it('should throw an error if PORT is not a valid number', () => {
      expect(() => validate({ PORT: 'invalid_port' })).toThrow(/Config validation error/);
    });

    it('should throw an error if NODE_ENV is not one of the allowed enum values', () => {
      expect(() => validate({ NODE_ENV: 'staging' })).toThrow(/Config validation error/);
    });

    it('should preserve optional Cloudinary configuration', () => {
      const config = validate({
        CLOUDINARY_CLOUD_NAME: 'test_cloud',
        CLOUDINARY_API_KEY: 'test_key',
        CLOUDINARY_API_SECRET: 'test_secret',
      });
      expect(config.CLOUDINARY_CLOUD_NAME).toBe('test_cloud');
      expect(config.CLOUDINARY_API_KEY).toBe('test_key');
      expect(config.CLOUDINARY_API_SECRET).toBe('test_secret');
    });
  });

  describe('Production Environment Security Enforcement', () => {
    it('should reject production boot if JWT_ACCESS_SECRET is missing', () => {
      expect(() =>
        validate({
          NODE_ENV: 'production',
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(/JWT_ACCESS_SECRET must be configured with at least 32/);
    });

    it('should reject production boot if JWT_ACCESS_SECRET is under 32 characters', () => {
      expect(() =>
        validate({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: 'short_secret_under_32',
          JWT_REFRESH_SECRET: validRefreshSecret,
        }),
      ).toThrow(/JWT_ACCESS_SECRET must be configured with at least 32/);
    });

    it('should reject production boot if JWT_REFRESH_SECRET is missing', () => {
      expect(() =>
        validate({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: validAccessSecret,
        }),
      ).toThrow(/JWT_REFRESH_SECRET must be configured with at least 32/);
    });

    it('should reject production boot if JWT_REFRESH_SECRET is under 32 characters', () => {
      expect(() =>
        validate({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: validAccessSecret,
          JWT_REFRESH_SECRET: 'short_refresh_secret',
        }),
      ).toThrow(/JWT_REFRESH_SECRET must be configured with at least 32/);
    });

    it('should reject production boot if CORS_ORIGIN is wildcard (*)', () => {
      expect(() =>
        validate({
          NODE_ENV: 'production',
          JWT_ACCESS_SECRET: validAccessSecret,
          JWT_REFRESH_SECRET: validRefreshSecret,
          CORS_ORIGIN: '*',
        }),
      ).toThrow(/CORS_ORIGIN cannot be set to wildcard/);
    });

    it('should accept valid production configuration with high-entropy secrets and specific origins', () => {
      const config = validate({
        NODE_ENV: 'production',
        PORT: 4000,
        CORS_ORIGIN: 'https://ar-dine.app,https://admin.ar-dine.app',
        FRONTEND_BASE_URL: 'https://ar-dine.app',
        JWT_ACCESS_SECRET: validAccessSecret,
        JWT_REFRESH_SECRET: validRefreshSecret,
      });

      expect(config.NODE_ENV).toBe(Environment.Production);
      expect(config.CORS_ORIGIN).toBe('https://ar-dine.app,https://admin.ar-dine.app');
      expect(config.FRONTEND_BASE_URL).toBe('https://ar-dine.app');
      expect(config.JWT_ACCESS_SECRET).toBe(validAccessSecret);
      expect(config.JWT_REFRESH_SECRET).toBe(validRefreshSecret);
    });
  });
});
