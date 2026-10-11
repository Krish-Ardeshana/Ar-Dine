import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AvailabilityStatus,
  MenuItemPublicationStatus,
} from '../../database/schemas/menu-item.schema.js';

export class MenuItemQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @IsOptional()
  @IsEnum(MenuItemPublicationStatus)
  publicationStatus?: MenuItemPublicationStatus;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVegetarian?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVegan?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}
