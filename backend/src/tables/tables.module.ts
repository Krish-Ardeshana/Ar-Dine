import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Restaurant,
  RestaurantSchema,
} from '../database/schemas/restaurant.schema.js';
import {
  RestaurantTable,
  RestaurantTableSchema,
} from '../database/schemas/restaurant-table.schema.js';
import { QrService } from './qr.service.js';
import { TablesController } from './tables.controller.js';
import { TablesService } from './tables.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RestaurantTable.name, schema: RestaurantTableSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
  ],
  controllers: [TablesController],
  providers: [TablesService, QrService],
  exports: [TablesService, QrService],
})
export class TablesModule {}
