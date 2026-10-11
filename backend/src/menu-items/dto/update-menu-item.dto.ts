import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
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
} from '../../database/schemas/menu-item.schema.js';
import {
  DietaryInfoDto,
  ImageMetadataDto,
  Model3DMetadataDto,
} from './create-menu-item.dto.js';

export class UpdateMenuItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

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

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @IsOptional()
  @IsEnum(MenuItemPublicationStatus)
  publicationStatus?: MenuItemPublicationStatus;

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
  preparationTimeMinutes?: number;
}
