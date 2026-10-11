import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RestaurantsController } from './restaurants.controller.js';
import { RestaurantsService } from './restaurants.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
