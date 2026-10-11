import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RestaurantDocument = Restaurant & Document;

export enum PublicationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum OperationalStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  PAUSED = 'PAUSED',
}

@Schema({ _id: false })
export class ContactInfo {
  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ trim: true })
  website?: string;
}

@Schema({ _id: false })
export class Address {
  @Prop({ required: true, trim: true })
  street: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true })
  postalCode: string;

  @Prop({ required: true, trim: true, default: 'India' })
  country: string;
}

@Schema({ timestamps: true, collection: 'restaurants' })
export class Restaurant {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: ContactInfo, required: true })
  contact: ContactInfo;

  @Prop({ type: Address, required: true })
  address: Address;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  ownerId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(PublicationStatus),
    default: PublicationStatus.DRAFT,
    index: true,
  })
  publicationStatus: PublicationStatus;

  @Prop({
    type: String,
    enum: Object.values(OperationalStatus),
    default: OperationalStatus.OPEN,
    index: true,
  })
  operationalStatus: OperationalStatus;

  @Prop({ required: true, trim: true, default: 'INR' })
  currency: string;

  @Prop({ required: true, trim: true, default: 'Asia/Kolkata' })
  timezone: string;
}

export const RestaurantSchema = SchemaFactory.createForClass(Restaurant);

// Compound index for operational catalog lookups
RestaurantSchema.index({ publicationStatus: 1, operationalStatus: 1 });
