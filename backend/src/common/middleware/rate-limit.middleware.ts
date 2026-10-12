import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateRecord {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly store = new Map<string, RateRecord>();
  private readonly windowMs = 60 * 1000; // 1 minute window
  private readonly maxRequests = 180; // 180 requests per minute per IP
  private cleanupTimer: NodeJS.Timeout;

  constructor() {
    // Periodically clean expired rate-limiting records every 2 minutes
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        if (now > record.resetTime) {
          this.store.delete(key);
        }
      }
    }, 2 * 60 * 1000);

    // Unref timer so it doesn't prevent process shutdown
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Bypass rate limiting for Server-Sent Events stream to prevent disconnect loops
    if (req.headers.accept?.includes('text/event-stream')) {
      return next();
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : Array.isArray(forwarded)
          ? forwarded[0]
          : null) ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    const record = this.store.get(ip);

    if (!record || now > record.resetTime) {
      this.store.set(ip, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return next();
    }

    if (record.count >= this.maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((record.resetTime - now) / 1000),
      );
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too many requests from this IP. Please try again later.',
        error: 'Too Many Requests',
      });
    }

    record.count++;
    next();
  }
}
