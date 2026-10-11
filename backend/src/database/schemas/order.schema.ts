import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  SERVED = 'SERVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
}

/**
 * Historical snapshot of an ordered item.
 * Preserves the exact name and price at the exact moment the order was placed.
 * Ensures future menu price changes or edits never corrupt historical financial data.
 */
@Schema({ _id: false })
export class OrderItemSnapshot {
  @Prop({ type: Types.ObjectId, ref: 'MenuItem', required: true })
  menuItemId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: Number, required: true, min: [0, 'Unit price must be non-negative'] })
  unitPrice: number;

  @Prop({ type: Number, required: true, min: [1, 'Quantity must be at least 1'] })
  quantity: number;

  @Prop({ type: Number, required: true, min: [0, 'Subtotal must be non-negative'] })
  subtotal: number;

  @Prop({ trim: true })
  specialInstructions?: string;
}

@Schema({ timestamps: true, collection: 'orders' })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RestaurantTable', required: true, index: true })
  tableId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DiningSession', index: true })
  diningSessionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  customerId?: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true, index: true })
  orderNumber: string;

  @Prop({ type: [OrderItemSnapshot], required: true, validate: [(val: OrderItemSnapshot[]) => val.length > 0, 'Order must contain at least one item'] })
  items: OrderItemSnapshot[];

  @Prop({ type: Number, required: true, min: [0, 'Subtotal must be non-negative'] })
  subtotal: number;

  @Prop({ type: Number, required: true, min: [0, 'Tax amount must be non-negative'], default: 0 })
  taxAmount: number;

  @Prop({ type: Number, required: true, min: [0, 'Discount amount must be non-negative'], default: 0 })
  discountAmount: number;

  @Prop({ type: Number, required: true, min: [0, 'Grand total must be non-negative'] })
  grandTotal: number;

  @Prop({
    type: String,
    enum: Object.values(OrderStatus),
    default: OrderStatus.PLACED,
    index: true,
  })
  status: OrderStatus;

  /**
   * Payment status is orthogonal to kitchen fulfillment status.
   * A dish can be PREPARING while payment is PENDING (dine-in post-pay) or PAID (pre-pay).
   */
  @Prop({
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PENDING,
    index: true,
  })
  paymentStatus: PaymentStatus;

  @Prop({ default: Date.now })
  placedAt: Date;

  @Prop()
  confirmedAt?: Date;

  @Prop()
  preparedAt?: Date;

  @Prop()
  servedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop({ trim: true })
  cancellationReason?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Compound indexes for live kitchen displays and order management
OrderSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, createdAt: -1 });
OrderSchema.index({ restaurantId: 1, tableId: 1, status: 1 });
