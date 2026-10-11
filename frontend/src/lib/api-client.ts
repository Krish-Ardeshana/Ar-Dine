import { BackendHealthResponse } from '@/types/api';
import { AuthResponse, AuthUser } from '@/types/auth';
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
