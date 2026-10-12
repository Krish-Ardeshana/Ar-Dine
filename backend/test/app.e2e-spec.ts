import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { HttpExceptionFilter } from './../src/common/filters/http-exception.filter.js';

describe('App & Auth Endpoints (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
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
    await app.close();
  });

  it('GET /api/v1/health should return 200 and healthy status with database diagnostics', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'ar-dine-backend',
    });
    expect(response.body.database).toBeDefined();
    expect(typeof response.body.database.status).toBe('string');
    expect(typeof response.body.database.ready).toBe('boolean');
    expect(typeof response.body.timestamp).toBe('string');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('GET /api/v1/auth/me should reject unauthenticated request with 401 Unauthorized', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/auth/login should reject malformed payload with 400 Bad Request', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({})
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('GET /api/v1/non-existent-route should return 404', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/non-existent-route')
      .expect(404);
  });

  it('POST /api/v1/restaurants should reject unauthenticated request with 401 Unauthorized', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants')
      .send({ name: 'Unauthorized Bistro', slug: 'unauthorized-bistro' })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/:id/categories should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/categories')
      .send({ name: 'Drinks' })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/:id/menu-items should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/menu-items')
      .send({ name: 'Burger', price: 150 })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/:id/media/upload-image should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/media/upload-image')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/:id/tables should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/tables')
      .send({ tableNumber: 'Table 1', capacity: 4 })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });


  it('POST /api/v1/restaurants/public/:slug/tables/:token/orders/validate should reject empty items payload with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/public/sample-bistro/tables/tbl_token/orders/validate')
      .send({ sessionToken: 'ses_123', items: [] })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('POST /api/v1/restaurants/public/:slug/tables/:token/orders should reject invalid order payload with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/public/sample-bistro/tables/tbl_token/orders')
      .send({ sessionToken: 'ses_123', items: [] })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('GET /api/v1/restaurants/:id/orders should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/orders')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('GET /api/v1/restaurants/:id/orders/kitchen should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/orders/kitchen')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('PATCH /api/v1/restaurants/:id/orders/:orderId/status should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/orders/6640a1b2c3d4e5f6a7b8c9d1/status')
      .send({ status: 'CONFIRMED' })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/:id/orders/:orderId/cancel should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/orders/6640a1b2c3d4e5f6a7b8c9d1/cancel')
      .send({ reason: 'Kitchen 86' })
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('GET /api/v1/restaurants/:id/dining-sessions should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/dining-sessions')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/:id/dining-sessions/:sessionId/close should reject unauthenticated request with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/6640a1b2c3d4e5f6a7b8c9d0/dining-sessions/6640a1b2c3d4e5f6a7b8c9d1/close')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });

  it('POST /api/v1/restaurants/public/:slug/tables/:token/orders should reject excessive quantity (>50) with 400 Bad Request', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/public/sample-bistro/tables/tbl_token/orders')
      .send({
        sessionToken: 'ses_123',
        items: [{ menuItemId: 'dish_1', quantity: 99 }],
      })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('POST /api/v1/restaurants/public/:slug/tables/:token/orders should reject unwhitelisted fields (forbidNonWhitelisted) with 400', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/restaurants/public/sample-bistro/tables/tbl_token/orders')
      .send({
        sessionToken: 'ses_123',
        items: [{ menuItemId: 'dish_1', quantity: 2 }],
        paymentStatus: 'PAID', // Malicious attempt to force paid state
        grandTotal: 0.01, // Malicious attempt to set client price
      })
      .expect(400);

    expect(response.body.statusCode).toBe(400);
  });

  it('GET /api/v1/restaurants/public/:slug/orders/:orderReference/events should reject subscription without token query param with 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/restaurants/public/sample-bistro/orders/ORD-20261012-0001/events')
      .expect(401);

    expect(response.body.statusCode).toBe(401);
  });
});
