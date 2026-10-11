export type TableStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE';

export interface RestaurantTableItem {
  id: string;
  restaurantId: string;
  tableNumber: string;
  tableToken: string;
  capacity: number;
  operationalStatus: TableStatus;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TableQrResponse {
  tableId: string;
  tableNumber: string;
  tableToken: string;
  restaurantId: string;
  restaurantSlug: string;
  restaurantName: string;
  targetUrl: string;
  qrDataUrl: string;
  qrSvg: string;
}

export interface PublicRestaurantSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  currency: string;
  timezone: string;
  isOperating: boolean;
}

export interface PublicTableSummary {
  id: string;
  tableNumber: string;
  capacity: number;
  operationalStatus: TableStatus;
  isAvailable: boolean;
}

export interface PublicTableResolution {
  restaurant: PublicRestaurantSummary;
  table: PublicTableSummary;
  qrUrl: string;
}

export interface CreateTablePayload {
  tableNumber: string;
  capacity?: number;
  operationalStatus?: TableStatus;
}

export interface UpdateTablePayload {
  tableNumber?: string;
  capacity?: number;
  operationalStatus?: TableStatus;
  isArchived?: boolean;
}
