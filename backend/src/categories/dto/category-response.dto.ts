import { CategoryStatus } from '../../database/schemas/category.schema.js';

export class CategoryResponseDto {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  displayOrder: number;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}
