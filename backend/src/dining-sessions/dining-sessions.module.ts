import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DiningSession,
  DiningSessionSchema,
} from '../database/schemas/dining-session.schema.js';
import {
  MenuItem,
  MenuItemSchema,
} from '../database/schemas/menu-item.schema.js';
import {
  Restaurant,
  RestaurantSchema,
} from '../database/schemas/restaurant.schema.js';
import {
  RestaurantTable,
  RestaurantTableSchema,
} from '../database/schemas/restaurant-table.schema.js';
import { DiningSessionsController } from './dining-sessions.controller.js';
import { DiningSessionsService } from './dining-sessions.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DiningSession.name, schema: DiningSessionSchema },
      { name: RestaurantTable.name, schema: RestaurantTableSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
  ],
  controllers: [DiningSessionsController],
  providers: [DiningSessionsService],
  exports: [DiningSessionsService],
})
export class DiningSessionsModule {}
