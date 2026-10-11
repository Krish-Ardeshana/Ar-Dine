import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { TableStatus } from '../../database/schemas/restaurant-table.schema.js';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  tableNumber: string;

  @IsInt()
  @Min(1, { message: 'Table capacity must be at least 1' })
  @Max(50, { message: 'Table capacity cannot exceed 50' })
  @IsOptional()
  capacity?: number = 4;

  @IsEnum(TableStatus)
  @IsOptional()
  operationalStatus?: TableStatus = TableStatus.AVAILABLE;
}
