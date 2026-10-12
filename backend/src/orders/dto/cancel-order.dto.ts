import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelOrderDto {
  @IsString()
  @IsOptional()
  @MaxLength(300, { message: 'Cancellation reason cannot exceed 300 characters' })
  reason?: string;
}
