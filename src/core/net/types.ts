// Networking Core types. No token value ever appears in an HttpError message.

export interface HttpRequestOptions {
  baseUrl: string;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  bearerToken?: string; // → Authorization: Bearer
  apiKey?: string; // → X-Api-Key (LNbits)
  idempotent?: boolean; // only idempotent reads auto-retry
  retries?: number; // default 3
  timeoutMs?: number; // default 8000
}

export interface HttpResponse<T> {
  status: number;
  data: T;
}

export type HttpErrorCode = 'client' | 'server' | 'network' | 'timeout';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: HttpErrorCode,
    message: string,
  ) {
    super(message); // message must NEVER contain a token/api key
    this.name = 'HttpError';
  }
}
