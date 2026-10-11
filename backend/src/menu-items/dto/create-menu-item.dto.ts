import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AvailabilityStatus,
  MenuItemPublicationStatus,
  SpiceLevel,
} from '../../database/schemas/menu-item.schema.js';

export class ImageMetadataDto {
  @IsString()
  @IsNotEmpty({ message: 'Image URL is required' })
  url: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsString()
  storageKey?: string;
}

export class Model3DMetadataDto {
  @IsOptional()
  @IsString()
  glbUrl?: string;

  @IsOptional()
  @IsString()
  usdzUrl?: string;

  @IsOptional()
  @IsEnum(['glb', 'gltf'])
  format?: 'glb' | 'gltf';

  @IsOptional()
  @IsInt()
  @Min(0)
  polyCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeBytes?: number;
}

export class DietaryInfoDto {
  @IsOptional()
  @IsBoolean()
  isVegetarian?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isVegan?: boolean = false;

  @IsOptional()
  @IsBoolean()
  isGlutenFree?: boolean = false;

  @IsOptional()
  @IsEnum(SpiceLevel)
  spiceLevel?: SpiceLevel = SpiceLevel.NONE;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[] = [];
}

export class CreateMenuItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Dish name is required' })
  @MinLength(2, { message: 'Dish name must be at least 2 characters' })
  @MaxLength(100, { message: 'Dish name must not exceed 100 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty({ message: 'Valid category ID is required' })
  categoryId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must be a valid number' })
  @Min(0, { message: 'Price must be non-negative' })
  price: number;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus = AvailabilityStatus.AVAILABLE;

  @IsOptional()
  @IsEnum(MenuItemPublicationStatus)
  publicationStatus?: MenuItemPublicationStatus = MenuItemPublicationStatus.PUBLISHED;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  image?: ImageMetadataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => Model3DMetadataDto)
  model3d?: Model3DMetadataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DietaryInfoDto)
  dietary?: DietaryInfoDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  preparationTimeMinutes?: number = 15;
}
