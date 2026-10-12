import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SecurityHeadersMiddleware } from './security-headers.middleware.js';
import { RateLimitMiddleware } from './rate-limit.middleware.js';
import { HttpStatus } from '@nestjs/common';

describe('Security & Rate-Limiting Middlewares', () => {
  describe('SecurityHeadersMiddleware', () => {
    let middleware: SecurityHeadersMiddleware;
    let mockReq: any;
    let mockRes: any;
    let next: any;

    beforeEach(() => {
      middleware = new SecurityHeadersMiddleware();
      mockReq = {};
      const headers = new Map<string, string>();
      mockRes = {
        setHeader: vi.fn((key: string, val: string) => headers.set(key, val)),
        getHeader: vi.fn((key: string) => headers.get(key)),
      };
      next = vi.fn();
    });

    it('should set critical OWASP security headers', () => {
      middleware.use(mockReq, mockRes, next);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'X-Content-Type-Options',
        'nosniff',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'strict-origin-when-cross-origin',
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('RateLimitMiddleware', () => {
    let middleware: RateLimitMiddleware;
    let mockReq: any;
    let mockRes: any;
    let next: any;

    beforeEach(() => {
      middleware = new RateLimitMiddleware();
      mockReq = {
        headers: { 'x-forwarded-for': '192.168.1.100' },
        socket: {},
      };
      mockRes = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
      };
      next = vi.fn();
    });

    it('should allow requests under the limit', () => {
      middleware.use(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should bypass rate limiting for SSE streams', () => {
      mockReq.headers.accept = 'text/event-stream';
      middleware.use(mockReq, mockRes, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should return 429 when rate limit is exceeded', () => {
      // Exceed max requests
      for (let i = 0; i < 185; i++) {
        middleware.use(mockReq, mockRes, next);
      }

      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.TOO_MANY_REQUESTS);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
        }),
      );
    });
  });
});
