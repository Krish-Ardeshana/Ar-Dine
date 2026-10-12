import { BackendHealthResponse } from '@/types/api';
import { AuthResponse, AuthUser } from '@/types/auth';
import {
  CreateTablePayload,
  PublicTableResolution,
  RestaurantTableItem,
  TableQrResponse,
  UpdateTablePayload,
} from '@/types/table';
import {
  DiningSessionResponse,
  ValidateCartOrderPayload,
  ValidateCartOrderResult,
} from '@/types/session';
import {
  CancelOrderPayload,
  CreateOrderPayload,
  Order,
  OrderStatus,
} from '@/types/order';
import { authStorage } from './auth-storage';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

export function getApiBaseUrl(): string {
  return API_BASE_URL.replace(/\/+$/, '');
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const rawMessage = data?.message;
    const errorMessage = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
      ? rawMessage
      : `HTTP Error ${response.status}: ${response.statusText}`;

    throw new Error(errorMessage);
  }

  return data as T;
}

export async function fetchBackendHealth(): Promise<BackendHealthResponse> {
  const url = `${getApiBaseUrl()}/health`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  return handleResponse<BackendHealthResponse>(response);
}

export async function loginUser(credentials: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const url = `${getApiBaseUrl()}/auth/login`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  const authData = await handleResponse<AuthResponse>(response);
  authStorage.setTokens(authData.accessToken, authData.refreshToken);
  return authData;
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const url = `${getApiBaseUrl()}/auth/register`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  const authData = await handleResponse<AuthResponse>(response);
  authStorage.setTokens(authData.accessToken, authData.refreshToken);
  return authData;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const token = authStorage.getAccessToken();
  if (!token) {
    throw new Error('No access token available');
  }

  const url = `${getApiBaseUrl()}/auth/me`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    // Attempt token refresh if available
    const refreshToken = authStorage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        const newAuth = await handleResponse<AuthResponse>(refreshResponse);
        authStorage.setTokens(newAuth.accessToken, newAuth.refreshToken);

        // Retry original request with new access token
        const retryResponse = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${newAuth.accessToken}`,
            Accept: 'application/json',
          },
        });
        return handleResponse<AuthUser>(retryResponse);
      } catch {
        authStorage.clearTokens();
        throw new Error('Session expired. Please log in again.');
      }
    }
    authStorage.clearTokens();
    throw new Error('Session expired');
  }

  return handleResponse<AuthUser>(response);
}

export async function logoutUser(): Promise<void> {
  const token = authStorage.getAccessToken();
  if (token) {
    try {
      await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
    } catch {
      // Ignore network errors on logout
    }
  }
  authStorage.clearTokens();
}

/**
 * Generic authenticated fetch wrapper with automatic token injection
 */
export async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = authStorage.getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${getApiBaseUrl()}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  return handleResponse<T>(response);
}

// ==========================================
// RESTAURANT APIS
// ==========================================

export async function fetchMyRestaurants(): Promise<import('@/types/restaurant').Restaurant[]> {
  return fetchWithAuth('/restaurants/me');
}

export async function fetchRestaurantById(
  restaurantId: string,
): Promise<import('@/types/restaurant').Restaurant> {
  const token = authStorage.getAccessToken();
  const headers: HeadersInit = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(`${getApiBaseUrl()}/restaurants/${restaurantId}`, {
    headers,
    cache: 'no-store',
  });
  return handleResponse<import('@/types/restaurant').Restaurant>(response);
}

export async function updateRestaurant(
  restaurantId: string,
  data: Partial<import('@/types/restaurant').Restaurant>,
): Promise<import('@/types/restaurant').Restaurant> {
  return fetchWithAuth(`/restaurants/${restaurantId}`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(data),
  });
}

export async function acceptInvitation(
  token: string,
): Promise<{ message: string; restaurantId: string; role: string }> {
  return fetchWithAuth('/restaurants/invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

// ==========================================
// CATEGORY APIS
// ==========================================

export async function fetchCategories(
  restaurantId: string,
  includeInactive = false,
): Promise<import('@/types/menu').Category[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return fetchWithAuth(`/restaurants/${restaurantId}/categories${query}`, {
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function createCategory(
  restaurantId: string,
  data: { name: string; description?: string; displayOrder?: number },
): Promise<import('@/types/menu').Category> {
  return fetchWithAuth(`/restaurants/${restaurantId}/categories`, {
    method: 'POST',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  restaurantId: string,
  categoryId: string,
  data: Partial<import('@/types/menu').Category>,
): Promise<import('@/types/menu').Category> {
  return fetchWithAuth(`/restaurants/${restaurantId}/categories/${categoryId}`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(data),
  });
}

export async function deleteCategory(
  restaurantId: string,
  categoryId: string,
): Promise<{ message: string; deletedId: string }> {
  return fetchWithAuth(`/restaurants/${restaurantId}/categories/${categoryId}`, {
    method: 'DELETE',
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function reorderCategories(
  restaurantId: string,
  orders: { id: string; displayOrder: number }[],
): Promise<import('@/types/menu').Category[]> {
  return fetchWithAuth(`/restaurants/${restaurantId}/categories/reorder`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify({ orders }),
  });
}

// ==========================================
// MENU ITEM APIS
// ==========================================

export async function fetchMenuItems(
  restaurantId: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<import('@/types/menu').PaginatedMenuItems> {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) queryParams.set(k, String(v));
  });
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  return fetchWithAuth(`/restaurants/${restaurantId}/menu-items${queryString}`, {
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function fetchMenuItemById(
  restaurantId: string,
  menuItemId: string,
): Promise<import('@/types/menu').MenuItem> {
  return fetchWithAuth(`/restaurants/${restaurantId}/menu-items/${menuItemId}`, {
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function createMenuItem(
  restaurantId: string,
  data: Partial<import('@/types/menu').MenuItem>,
): Promise<import('@/types/menu').MenuItem> {
  return fetchWithAuth(`/restaurants/${restaurantId}/menu-items`, {
    method: 'POST',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(data),
  });
}

export async function updateMenuItem(
  restaurantId: string,
  menuItemId: string,
  data: Partial<import('@/types/menu').MenuItem>,
): Promise<import('@/types/menu').MenuItem> {
  return fetchWithAuth(`/restaurants/${restaurantId}/menu-items/${menuItemId}`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(data),
  });
}

export async function updateItemAvailability(
  restaurantId: string,
  menuItemId: string,
  availabilityStatus: import('@/types/menu').AvailabilityStatus,
): Promise<import('@/types/menu').MenuItem> {
  return fetchWithAuth(`/restaurants/${restaurantId}/menu-items/${menuItemId}/availability`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify({ availabilityStatus }),
  });
}

export async function deleteMenuItem(
  restaurantId: string,
  menuItemId: string,
): Promise<{ message: string; deletedId: string; status: 'DELETED' | 'ARCHIVED' }> {
  return fetchWithAuth(`/restaurants/${restaurantId}/menu-items/${menuItemId}`, {
    method: 'DELETE',
    headers: { 'x-restaurant-id': restaurantId },
  });
}

// ==========================================
// MEDIA UPLOAD APIS
// ==========================================

export async function uploadDishImage(
  restaurantId: string,
  file: File,
  altText?: string,
): Promise<import('@/types/menu').ImageMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  if (altText) {
    formData.append('altText', altText);
  }

  return fetchWithAuth(`/restaurants/${restaurantId}/media/upload-image`, {
    method: 'POST',
    headers: { 'x-restaurant-id': restaurantId },
    body: formData,
  });
}

export async function uploadDishModel(
  restaurantId: string,
  file: File,
): Promise<import('@/types/menu').Model3DMetadata> {
  const formData = new FormData();
  formData.append('file', file);

  return fetchWithAuth(`/restaurants/${restaurantId}/media/upload-model`, {
    method: 'POST',
    headers: { 'x-restaurant-id': restaurantId },
    body: formData,
  });
}

export async function deleteMedia(
  restaurantId: string,
  storageKey: string,
): Promise<{ message: string }> {
  return fetchWithAuth(`/restaurants/${restaurantId}/media`, {
    method: 'DELETE',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify({ storageKey }),
  });
}

// --- Table Management & QR ---

export async function fetchTables(
  restaurantId: string,
  includeArchived = false,
): Promise<RestaurantTableItem[]> {
  const query = includeArchived ? '?includeArchived=true' : '';
  return fetchWithAuth(`/restaurants/${restaurantId}/tables${query}`, {
    method: 'GET',
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function createTable(
  restaurantId: string,
  payload: CreateTablePayload,
): Promise<RestaurantTableItem> {
  return fetchWithAuth(`/restaurants/${restaurantId}/tables`, {
    method: 'POST',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(payload),
  });
}

export async function updateTable(
  restaurantId: string,
  tableId: string,
  payload: UpdateTablePayload,
): Promise<RestaurantTableItem> {
  return fetchWithAuth(`/restaurants/${restaurantId}/tables/${tableId}`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify(payload),
  });
}

export async function deleteTable(
  restaurantId: string,
  tableId: string,
): Promise<{ message: string }> {
  return fetchWithAuth(`/restaurants/${restaurantId}/tables/${tableId}`, {
    method: 'DELETE',
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function fetchTableQr(
  restaurantId: string,
  tableId: string,
): Promise<TableQrResponse> {
  return fetchWithAuth(`/restaurants/${restaurantId}/tables/${tableId}/qr`, {
    method: 'GET',
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function fetchBatchTableQrs(
  restaurantId: string,
): Promise<TableQrResponse[]> {
  return fetchWithAuth(`/restaurants/${restaurantId}/tables/qr/batch`, {
    method: 'GET',
    headers: { 'x-restaurant-id': restaurantId },
  });
}

// --- Public QR Resolution & Dining Sessions ---

export async function resolvePublicTable(
  slug: string,
  tableToken: string,
): Promise<PublicTableResolution> {
  const url = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(slug)}/tables/${encodeURIComponent(tableToken)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return handleResponse<PublicTableResolution>(response);
}

export async function fetchPublicDishes(
  restaurantId: string,
  categoryId?: string,
): Promise<import('@/types/menu').MenuItem[]> {
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}&limit=100` : '?limit=100';
  const url = `${getApiBaseUrl()}/restaurants/${encodeURIComponent(restaurantId)}/menu-items${query}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await handleResponse<import('@/types/menu').PaginatedMenuItems>(response);
  return data.items;
}

export async function fetchPublicCategories(
  restaurantId: string,
): Promise<import('@/types/menu').Category[]> {
  const url = `${getApiBaseUrl()}/restaurants/${encodeURIComponent(restaurantId)}/categories`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return handleResponse<import('@/types/menu').Category[]>(response);
}

export async function getOrCreatePublicSession(
  slug: string,
  tableToken: string,
): Promise<DiningSessionResponse> {
  const url = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(slug)}/tables/${encodeURIComponent(tableToken)}/sessions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    cache: 'no-store',
  });
  return handleResponse<DiningSessionResponse>(response);
}

export async function validateSession(
  sessionToken: string,
): Promise<DiningSessionResponse> {
  const url = `${getApiBaseUrl()}/dining-sessions/${encodeURIComponent(sessionToken)}/validate`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return handleResponse<DiningSessionResponse>(response);
}

export async function validateCartOrder(
  slug: string,
  tableToken: string,
  payload: ValidateCartOrderPayload,
): Promise<ValidateCartOrderResult> {
  const url = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(slug)}/tables/${encodeURIComponent(tableToken)}/orders/validate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return handleResponse<ValidateCartOrderResult>(response);
}

// ==========================================
// ORDER & KDS APIS (PHASE 6)
// ==========================================

export async function createOrder(
  slug: string,
  tableToken: string,
  payload: CreateOrderPayload,
): Promise<Order> {
  const url = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(slug)}/tables/${encodeURIComponent(tableToken)}/orders`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return handleResponse<Order>(response);
}

export async function fetchPublicOrderTracking(
  slug: string,
  orderReference: string,
  trackingToken: string,
): Promise<Order> {
  const url = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderReference)}?token=${encodeURIComponent(trackingToken)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return handleResponse<Order>(response);
}

export async function cancelPublicOrder(
  slug: string,
  orderReference: string,
  trackingToken: string,
  payload: CancelOrderPayload,
): Promise<Order> {
  const url = `${getApiBaseUrl()}/restaurants/public/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderReference)}/cancel?token=${encodeURIComponent(trackingToken)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  return handleResponse<Order>(response);
}

export async function fetchKitchenQueue(restaurantId: string): Promise<Order[]> {
  return fetchWithAuth(`/restaurants/${encodeURIComponent(restaurantId)}/orders/kitchen`, {
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function fetchRestaurantOrders(
  restaurantId: string,
  status?: OrderStatus,
): Promise<Order[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchWithAuth(`/restaurants/${encodeURIComponent(restaurantId)}/orders${query}`, {
    headers: { 'x-restaurant-id': restaurantId },
  });
}

export async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  return fetchWithAuth(`/restaurants/${encodeURIComponent(restaurantId)}/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify({ status }),
  });
}

export async function cancelStaffOrder(
  restaurantId: string,
  orderId: string,
  reason?: string,
): Promise<Order> {
  return fetchWithAuth(`/restaurants/${encodeURIComponent(restaurantId)}/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: 'POST',
    headers: { 'x-restaurant-id': restaurantId },
    body: JSON.stringify({ reason }),
  });
}


