import {
  AvailabilityStatus,
  MenuItemPublicationStatus,
  SpiceLevel,
} from '../../database/schemas/menu-item.schema.js';

export class MenuItemResponseDto {
  id: string;
  restaurantId: string;
  categoryId: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  availabilityStatus: AvailabilityStatus;
  publicationStatus: MenuItemPublicationStatus;
  image?: {
    url: string;
    altText?: string;
    storageKey?: string;
  };
  model3d?: {
    glbUrl?: string;
    usdzUrl?: string;
    format?: string;
    polyCount?: number;
    fileSizeBytes?: number;
  };
  dietary: {
    isVegetarian: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
    spiceLevel: SpiceLevel;
    allergens: string[];
  };
  preparationTimeMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export class PaginatedMenuItemsDto {
  items: MenuItemResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
