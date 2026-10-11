export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';

export interface DiningSessionResponse {
  id: string;
  sessionToken: string;
  restaurantId: string;
  tableId: string;
  tableNumber: string;
  restaurantName: string;
  restaurantSlug: string;
  status: SessionStatus;
  expiresAt: string;
  createdAt: string;
}

export interface CartItem {
  dishId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  specialInstructions?: string;
  imageUrl?: string;
  modelUrl?: string;
}

export interface ValidateCartItemPayload {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string;
}

export interface ValidateCartOrderPayload {
  sessionToken: string;
  items: ValidateCartItemPayload[];
}

export interface ValidatedItemResult {
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  specialInstructions?: string;
}

export interface ValidateCartOrderResult {
  valid: boolean;
  canSubmitInPhase6: boolean;
  message: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  items: ValidatedItemResult[];
}
