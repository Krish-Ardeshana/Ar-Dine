import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;
}
