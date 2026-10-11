import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CategoryDocument = Category & Document;

export enum CategoryStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  displayOrder: number;

  @Prop({
    type: String,
    enum: Object.values(CategoryStatus),
    default: CategoryStatus.ACTIVE,
    index: true,
  })
  status: CategoryStatus;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

// Compound unique index ensuring category names are unique per restaurant
CategorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

// Compound index for sorted menu display queries
CategorySchema.index({ restaurantId: 1, displayOrder: 1, status: 1 });
