import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Order, OrderSchema } from '../database/schemas/order.schema.js';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from '../database/schemas/payment-transaction.schema.js';
import {
  Restaurant,
  RestaurantSchema,
} from '../database/schemas/restaurant.schema.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { SandboxPaymentGateway } from './providers/sandbox-payment-gateway.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
    ]),
    AuthModule,
    OrdersModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, SandboxPaymentGateway],
  exports: [PaymentsService],
})
export class PaymentsModule {}
