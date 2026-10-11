import { IsEnum, IsNotEmpty } from 'class-validator';
import { AvailabilityStatus } from '../../database/schemas/menu-item.schema.js';

export class UpdateAvailabilityDto {
  @IsEnum(AvailabilityStatus, {
    message: 'Availability status must be AVAILABLE or OUT_OF_STOCK',
  })
  @IsNotEmpty()
  availabilityStatus: AvailabilityStatus;
}
