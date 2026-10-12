import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  transactionReference: string;

  @IsString()
  @IsOptional()
  providerPaymentId?: string;
}
