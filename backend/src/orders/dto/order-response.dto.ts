import { OrderStatus, PaymentStatus } from '../../database/schemas/order.schema.js';

export class OrderItemResponseDto {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  specialInstructions?: string;
}

export class OrderResponseDto {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  diningSessionId?: string;
  orderNumber: string;
  trackingToken?: string;
  items: OrderItemResponseDto[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt: Date;
  confirmedAt?: Date;
  preparedAt?: Date;
  servedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  cancelledBy?: string;
  createdAt: Date;
  updatedAt: Date;
}
