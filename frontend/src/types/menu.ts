export enum CategoryStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  displayOrder: number;
  status: CategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export enum MenuItemPublicationStatus {
  PUBLISHED = 'PUBLISHED',
  DRAFT = 'DRAFT',
  ARCHIVED = 'ARCHIVED',
}

export enum SpiceLevel {
  NONE = 'NONE',
  MILD = 'MILD',
  MEDIUM = 'MEDIUM',
  HOT = 'HOT',
}

export interface ImageMetadata {
  url: string;
  altText?: string;
  storageKey?: string;
}

export interface Model3DMetadata {
  glbUrl?: string;
  usdzUrl?: string;
  format?: 'glb' | 'gltf';
  polyCount?: number;
  fileSizeBytes?: number;
}

export interface DietaryInfo {
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  spiceLevel: SpiceLevel;
  allergens: string[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  slug: string;
  name: string;
  description?: string;
  price: number;
  availabilityStatus: AvailabilityStatus;
  publicationStatus: MenuItemPublicationStatus;
  image?: ImageMetadata;
  model3d?: Model3DMetadata;
  dietary: DietaryInfo;
  preparationTimeMinutes: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedMenuItems {
  items: MenuItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
