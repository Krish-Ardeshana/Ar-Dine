import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  RESTAURANT_ADMIN = 'RESTAURANT_ADMIN',
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  WAITER = 'WAITER',
  CUSTOMER = 'CUSTOMER',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

@Schema({ _id: false })
export class RestaurantMembership {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({
    type: [String],
    enum: Object.values(UserRole),
    required: true,
    default: [UserRole.CUSTOMER],
  })
  roles: UserRole[];
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ select: false })
  passwordHash?: string;

  @Prop({
    type: String,
    enum: Object.values(AccountStatus),
    default: AccountStatus.ACTIVE,
    index: true,
  })
  accountStatus: AccountStatus;

  @Prop({
    type: [String],
    enum: Object.values(UserRole),
    default: [UserRole.CUSTOMER],
    index: true,
  })
  globalRoles: UserRole[];

  @Prop({ type: [RestaurantMembership], default: [] })
  memberships: RestaurantMembership[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// Ensure index on membership lookup
UserSchema.index({ 'memberships.restaurantId': 1 });
