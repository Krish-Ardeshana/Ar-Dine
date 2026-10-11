import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RestaurantTableDocument = RestaurantTable & Document;

export enum TableStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

@Schema({ timestamps: true, collection: 'restaurant_tables' })
export class RestaurantTable {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  tableNumber: string;

  /**
   * Secure, non-sequential token embedded in physical QR codes.
   * Format: `tbl_<nanoid/uuid>`.
   * When dishes or prices change, QR URLs remain stable because they target this immutable token.
   */
  @Prop({ required: true, unique: true, trim: true, index: true })
  tableToken: string;

  @Prop({ type: Number, default: 4, min: [1, 'Table capacity must be at least 1'] })
  capacity: number;

  @Prop({
    type: String,
    enum: Object.values(TableStatus),
    default: TableStatus.AVAILABLE,
    index: true,
  })
  operationalStatus: TableStatus;

  @Prop({ type: Boolean, default: false, index: true })
  isArchived: boolean;
}

export const RestaurantTableSchema = SchemaFactory.createForClass(RestaurantTable);

// Compound unique index ensuring table numbers are unique per restaurant
RestaurantTableSchema.index({ restaurantId: 1, tableNumber: 1 }, { unique: true });

// Index for table token QR lookup
RestaurantTableSchema.index({ tableToken: 1 }, { unique: true });
