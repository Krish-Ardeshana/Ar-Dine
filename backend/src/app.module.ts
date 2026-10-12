import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { validate } from './config/env.validation.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { MenuItemsModule } from './menu-items/menu-items.module.js';
import { RestaurantsModule } from './restaurants/restaurants.module.js';
import { TablesModule } from './tables/tables.module.js';
import { DiningSessionsModule } from './dining-sessions/dining-sessions.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { SecurityHeadersMiddleware } from './common/middleware/security-headers.middleware.js';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    RestaurantsModule,
    CategoriesModule,
    MenuItemsModule,
    MediaModule,
    TablesModule,
    DiningSessionsModule,
    OrdersModule,
    PaymentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(SecurityHeadersMiddleware, RateLimitMiddleware)
      .forRoutes('*');
  }
}

