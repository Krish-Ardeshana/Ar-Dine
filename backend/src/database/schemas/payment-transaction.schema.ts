import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PaymentTransactionDocument = PaymentTransaction & Document;

export enum PaymentTransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Schema({ timestamps: true, collection: 'payment_transactions' })
export class PaymentTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true, index: true })
  orderId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DiningSession', index: true })
  diningSessionId?: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true })
  transactionReference: string;

  @Prop({ required: true, min: [0, 'Payment amount must be non-negative'] })
  amount: number;

  @Prop({ required: true, default: 'INR', trim: true })
  currency: string;

  @Prop({
    type: String,
    enum: Object.values(PaymentTransactionStatus),
    default: PaymentTransactionStatus.PENDING,
    index: true,
  })
  status: PaymentTransactionStatus;

  @Prop({ required: true, default: 'sandbox', trim: true })
  provider: string;

  @Prop({ trim: true, index: true })
  providerPaymentId?: string;

  @Prop({ trim: true })
  providerOrderId?: string;

  @Prop({ required: true, trim: true, index: true })
  idempotencyKey: string;

  @Prop({ trim: true })
  paymentMethod?: string;

  @Prop({ trim: true })
  failureReason?: string;

  @Prop({ type: Object, default: () => ({}) })
  metadata: Record<string, unknown>;

  @Prop()
  completedAt?: Date;
}

export const PaymentTransactionSchema = SchemaFactory.createForClass(PaymentTransaction);

// Compound index for idempotent payment lookups
PaymentTransactionSchema.index({ restaurantId: 1, idempotencyKey: 1 }, { unique: true });

// Compound index for order payment history
PaymentTransactionSchema.index({ restaurantId: 1, orderId: 1, status: 1 });
