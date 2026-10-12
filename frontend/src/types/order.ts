export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';

export interface OrderItemSnapshot {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  specialInstructions?: string;
}

export interface Order {
  id: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  diningSessionId?: string;
  orderNumber: string;
  trackingToken?: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  placedAt?: string;
  confirmedAt?: string;
  preparedAt?: string;
  readyAt?: string;
  servedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemPayload {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string;
}

export interface CreateOrderPayload {
  sessionToken: string;
  items: CreateOrderItemPayload[];
  idempotencyKey?: string;
}

export interface CancelOrderPayload {
  reason?: string;
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
}

export interface OrderEvent {
  type: 'ORDER_PLACED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED';
  restaurantId: string;
  orderNumber: string;
  trackingToken?: string;
  order: Order;
  timestamp: string;
}
