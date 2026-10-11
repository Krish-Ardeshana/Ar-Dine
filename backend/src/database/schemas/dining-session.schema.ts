import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DiningSessionDocument = DiningSession & Document;

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true, collection: 'dining_sessions' })
export class DiningSession {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'RestaurantTable', required: true, index: true })
  tableId: Types.ObjectId;

  /**
   * Opaque session token issued to customer browser session upon scanning table QR.
   */
  @Prop({ required: true, unique: true, trim: true, index: true })
  sessionToken: string;

  @Prop({
    type: String,
    enum: Object.values(SessionStatus),
    default: SessionStatus.ACTIVE,
    index: true,
  })
  status: SessionStatus;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop()
  closedAt?: Date;
}

export const DiningSessionSchema = SchemaFactory.createForClass(DiningSession);

// Compound index for active session lookup per table
DiningSessionSchema.index({ restaurantId: 1, tableId: 1, status: 1 });

// TTL/expiry index for session house-keeping
DiningSessionSchema.index({ expiresAt: 1 });
