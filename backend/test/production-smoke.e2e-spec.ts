import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';

describe('Production Smoke Verification (E2E)', () => {
  let app: INestApplication;
  const prodFrontendOrigin = 'https://ar-dine.production.app';

  beforeAll(async () => {
    // Set environment simulation variables before module initialization
    process.env.NODE_ENV = 'production';
    process.env.PORT = '4000';
    process.env.CORS_ORIGIN = prodFrontendOrigin;
    process.env.FRONTEND_BASE_URL = prodFrontendOrigin;
    process.env.JWT_ACCESS_SECRET = 'a_secure_production_access_key_of_32_characters_minimum!';
    process.env.JWT_REFRESH_SECRET = 'a_secure_production_refresh_key_of_32_characters_minimum!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableCors({
      origin: prodFrontendOrigin,
      credentials: true,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Production Readiness & Health Probe', () => {
    it('GET /api/v1/health should return 200 OK with valid environment stamp', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('ar-dine-backend');
      expect(['production', 'test']).toContain(response.body.environment);
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.database).toBeDefined();
      expect(response.body.database.status).toBe('unconfigured');
      expect(response.body.database.ready).toBe(false);
    });

    it('GET /api/v1/health should not leak internal server paths or secret credentials', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('JWT_ACCESS_SECRET');
      expect(responseText).not.toContain('JWT_REFRESH_SECRET');
      expect(responseText).not.toContain('MONGODB_URI');
      expect(responseText).not.toContain('password');
      expect(responseText).not.toContain('secret');
    });
  });

  describe('2. Production CORS Restriction', () => {
    it('OPTIONS /api/v1/health from authorized origin should receive CORS allow origin headers', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/health')
        .set('Origin', prodFrontendOrigin)
        .set('Access-Control-Request-Method', 'GET');

      expect(response.headers['access-control-allow-origin']).toBe(prodFrontendOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('3. Production Security & Route Boundary Protection', () => {
    it('POST /api/v1/auth/login with empty body should be caught by global ValidationPipe with 400', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      expect(response.body.statusCode).toBe(400);
      expect(response.body.message).toBeDefined();
    });

    it('POST /api/v1/orders/kitchen without JWT token should reject with 401 Unauthorized', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/restaurants/64f1a2b3c4d5e6f7a8b9c0d1/orders/kitchen')
        .expect(401);
    });
  });
});
