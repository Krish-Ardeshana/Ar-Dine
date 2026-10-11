export interface DatabaseHealthInfo {
  status: string;
  ready: boolean;
  databaseName?: string;
  host?: string;
}

export interface BackendHealthResponse {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
  uptime: number;
  database?: DatabaseHealthInfo;
}

export interface ApiClientConfig {
  baseUrl: string;
}
