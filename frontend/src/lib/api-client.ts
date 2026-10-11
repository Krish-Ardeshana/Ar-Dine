import { BackendHealthResponse } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";

export async function fetchBackendHealth(): Promise<BackendHealthResponse> {
  const url = `${API_BASE_URL.replace(/\/+$/, "")}/health`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Backend returned HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}
