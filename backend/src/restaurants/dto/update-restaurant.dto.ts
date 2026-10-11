import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  OperationalStatus,
  PublicationStatus,
} from '../../database/schemas/restaurant.schema.js';
import { AddressDto, ContactInfoDto } from './create-restaurant.dto.js';

export class UpdateRestaurantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactInfoDto)
  contact?: ContactInfoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @IsEnum(PublicationStatus)
  publicationStatus?: PublicationStatus;

  @IsOptional()
  @IsEnum(OperationalStatus)
  operationalStatus?: OperationalStatus;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
