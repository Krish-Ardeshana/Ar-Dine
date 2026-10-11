import { TableStatus } from '../../database/schemas/restaurant-table.schema.js';

export class PublicRestaurantSummaryDto {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  currency: string;
  timezone: string;
  isOperating: boolean;
}

export class PublicTableSummaryDto {
  id: string;
  tableNumber: string;
  capacity: number;
  operationalStatus: TableStatus;
  isAvailable: boolean;
}

export class PublicTableResolutionDto {
  restaurant: PublicRestaurantSummaryDto;
  table: PublicTableSummaryDto;
  qrUrl: string;
}
