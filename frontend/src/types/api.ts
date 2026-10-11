export interface BackendHealthResponse {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
  uptime: number;
}

export interface ApiClientConfig {
  baseUrl: string;
}
