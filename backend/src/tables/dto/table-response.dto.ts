import { TableStatus } from '../../database/schemas/restaurant-table.schema.js';

export class TableResponseDto {
  id: string;
  restaurantId: string;
  tableNumber: string;
  tableToken: string;
  capacity: number;
  operationalStatus: TableStatus;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}
