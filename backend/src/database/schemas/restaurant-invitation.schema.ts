import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from './user.schema.js';

export type RestaurantInvitationDocument = RestaurantInvitation & Document;

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Schema({ timestamps: true, collection: 'restaurant_invitations' })
export class RestaurantInvitation {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  email: string;

  @Prop({
    type: String,
    enum: [
      UserRole.RESTAURANT_ADMIN,
      UserRole.KITCHEN_STAFF,
      UserRole.WAITER,
    ],
    required: true,
  })
  role: UserRole;

  @Prop({ required: true, select: false })
  tokenHash: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  invitedBy: Types.ObjectId;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({
    type: String,
    enum: Object.values(InvitationStatus),
    default: InvitationStatus.PENDING,
    index: true,
  })
  status: InvitationStatus;
}

export const RestaurantInvitationSchema =
  SchemaFactory.createForClass(RestaurantInvitation);

// Compound index for active pending invitations lookup
RestaurantInvitationSchema.index({ email: 1, status: 1 });
RestaurantInvitationSchema.index({ restaurantId: 1, email: 1, status: 1 });
