import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  OperationalStatus,
  PublicationStatus,
} from '../../database/schemas/restaurant.schema.js';

export class ContactInfoDto {
  @IsEmail({}, { message: 'Contact email must be a valid email address' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Contact phone number is required' })
  phone: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class AddressDto {
  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  street: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'State is required' })
  state: string;

  @IsString()
  @IsNotEmpty({ message: 'Postal code is required' })
  postalCode: string;

  @IsOptional()
  @IsString()
  country?: string = 'India';
}

export class CreateRestaurantDto {
  @IsString()
  @MinLength(2, { message: 'Restaurant name must be at least 2 characters' })
  @MaxLength(100, { message: 'Restaurant name must not exceed 100 characters' })
  name: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ValidateNested()
  @Type(() => ContactInfoDto)
  contact: ContactInfoDto;

  @ValidateNested()
  @Type(() => AddressDto)
  address: AddressDto;

  @IsOptional()
  @IsEmail({}, { message: 'Owner email must be a valid email address' })
  ownerEmail?: string;

  @IsOptional()
  @IsEnum(PublicationStatus)
  publicationStatus?: PublicationStatus = PublicationStatus.DRAFT;

  @IsOptional()
  @IsEnum(OperationalStatus)
  operationalStatus?: OperationalStatus = OperationalStatus.OPEN;

  @IsOptional()
  @IsString()
  currency?: string = 'INR';

  @IsOptional()
  @IsString()
  timezone?: string = 'Asia/Kolkata';
}
