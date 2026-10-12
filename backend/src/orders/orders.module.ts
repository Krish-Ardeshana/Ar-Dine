import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DiningSessionsModule } from '../dining-sessions/dining-sessions.module.js';
import { MenuItem, MenuItemSchema } from '../database/schemas/menu-item.schema.js';
import { Order, OrderSchema } from '../database/schemas/order.schema.js';
import { Restaurant, RestaurantSchema } from '../database/schemas/restaurant.schema.js';
import { RestaurantTable, RestaurantTableSchema } from '../database/schemas/restaurant-table.schema.js';
import { OrderEventsService } from './order-events.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: RestaurantTable.name, schema: RestaurantTableSchema },
      { name: MenuItem.name, schema: MenuItemSchema },
    ]),
    DiningSessionsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderEventsService],
  exports: [OrdersService, OrderEventsService],
})
export class OrdersModule {}
