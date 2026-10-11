import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TableStatus } from '../../database/schemas/restaurant-table.schema.js';

export class UpdateTableDto {
  @IsString()
  @IsOptional()
  tableNumber?: string;

  @IsInt()
  @Min(1, { message: 'Table capacity must be at least 1' })
  @Max(50, { message: 'Table capacity cannot exceed 50' })
  @IsOptional()
  capacity?: number;

  @IsEnum(TableStatus)
  @IsOptional()
  operationalStatus?: TableStatus;

  @IsBoolean()
  @IsOptional()
  isArchived?: boolean;
}
