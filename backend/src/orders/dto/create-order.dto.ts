import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  menuItemId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(50, { message: 'Quantity cannot exceed 50 per item' })
  quantity: number;

  @IsString()
  @IsOptional()
  @MaxLength(200, { message: 'Special instructions cannot exceed 200 characters' })
  specialInstructions?: string;
}

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  sessionToken: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsString()
  @IsOptional()
  @MaxLength(128, { message: 'Idempotency key cannot exceed 128 characters' })
  idempotencyKey?: string;
}
