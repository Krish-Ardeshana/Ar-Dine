import { IsEnum, IsNotEmpty } from 'class-validator';
import { OrderStatus } from '../../database/schemas/order.schema.js';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'Invalid order status transition target' })
  @IsNotEmpty()
  status: OrderStatus;
}
