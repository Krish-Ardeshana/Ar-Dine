import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MenuItemDocument = MenuItem & Document;

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export enum MenuItemPublicationStatus {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

export enum SpiceLevel {
  NONE = 'NONE',
  MILD = 'MILD',
  MEDIUM = 'MEDIUM',
  HOT = 'HOT',
}

@Schema({ _id: false })
export class ImageMetadata {
  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ trim: true })
  altText?: string;

  @Prop({ trim: true })
  storageKey?: string;
}

@Schema({ _id: false })
export class Model3DMetadata {
  @Prop({ trim: true })
  glbUrl?: string;

  @Prop({ trim: true })
  usdzUrl?: string;

  @Prop({ type: String, enum: ['glb', 'gltf'], default: 'glb' })
  format?: 'glb' | 'gltf';

  @Prop({ type: Number, min: 0 })
  polyCount?: number;

  @Prop({ type: Number, min: 0 })
  fileSizeBytes?: number;
}

@Schema({ _id: false })
export class DietaryInfo {
  @Prop({ type: Boolean, default: false })
  isVegetarian: boolean;

  @Prop({ type: Boolean, default: false })
  isVegan: boolean;

  @Prop({ type: Boolean, default: false })
  isGlutenFree: boolean;

  @Prop({
    type: String,
    enum: Object.values(SpiceLevel),
    default: SpiceLevel.NONE,
  })
  spiceLevel: SpiceLevel;

  @Prop({ type: [String], default: [] })
  allergens: string[];
}

@Schema({ timestamps: true, collection: 'menu_items' })
export class MenuItem {
  @Prop({ type: Types.ObjectId, ref: 'Restaurant', required: true, index: true })
  restaurantId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Number, required: true, min: [0, 'Price must be non-negative'] })
  price: number;

  @Prop({
    type: String,
    enum: Object.values(AvailabilityStatus),
    default: AvailabilityStatus.AVAILABLE,
    index: true,
  })
  availabilityStatus: AvailabilityStatus;

  @Prop({
    type: String,
    enum: Object.values(MenuItemPublicationStatus),
    default: MenuItemPublicationStatus.PUBLISHED,
    index: true,
  })
  publicationStatus: MenuItemPublicationStatus;

  @Prop({ type: ImageMetadata })
  image?: ImageMetadata;

  @Prop({ type: Model3DMetadata })
  model3d?: Model3DMetadata;

  @Prop({ type: DietaryInfo, default: () => ({}) })
  dietary: DietaryInfo;

  @Prop({ type: Number, default: 15, min: [0, 'Preparation time must be non-negative'] })
  preparationTimeMinutes: number;
}

export const MenuItemSchema = SchemaFactory.createForClass(MenuItem);

// Compound unique index ensuring item slugs are unique per restaurant
MenuItemSchema.index({ restaurantId: 1, slug: 1 }, { unique: true });

// Compound index for category listings with availability filters
MenuItemSchema.index({
  restaurantId: 1,
  categoryId: 1,
  publicationStatus: 1,
  availabilityStatus: 1,
});
