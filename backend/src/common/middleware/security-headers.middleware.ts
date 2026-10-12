import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Prevent MIME-sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent framing/clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Cross-site scripting legacy filter
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // HTTP Strict Transport Security
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );

    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy for camera (needed for AR/QR scanning), microphone disabled
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(), geolocation=()',
    );

    // Content Security Policy
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; model-src 'self' https: blob:; connect-src 'self' *;",
    );

    next();
  }
}
