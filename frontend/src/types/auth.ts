export type UserRole =
  | 'SUPER_ADMIN'
  | 'RESTAURANT_ADMIN'
  | 'KITCHEN_STAFF'
  | 'WAITER'
  | 'CUSTOMER';

export interface RestaurantMembership {
  restaurantId: string;
  roles: UserRole[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  globalRoles: UserRole[];
  memberships: RestaurantMembership[];
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
  errors?: unknown;
}
