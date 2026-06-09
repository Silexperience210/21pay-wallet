// fetch-based REST client with retry/backoff + request-time auth injection.
// Mirrors the AbortController/timeout pattern from featureGate. Bearer/X-Api-Key
// are injected per request and NEVER written to logs or error messages.
import { HttpError, HttpRequestOptions, HttpResponse } from './types';

/** Pure backoff schedule so tests assert it without sleeping. */
export function backoffDelayMs(attempt: number): number {
  const base = Math.min(200 * 2 ** attempt, 5000);
  return base + Math.floor(Math.random() * 100); // jitter
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function httpRequest<T>(opts: HttpRequestOptions): Promise<HttpResponse<T>> {
  const {
    baseUrl,
    path,
    method = 'GET',
    body,
    headers = {},
    bearerToken,
    apiKey,
    idempotent = false,
    retries = 3,
    timeoutMs = 8000,
  } = opts;

  const url = `${baseUrl.replace(/\/+$/, '')}${path}`;
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...headers };
  if (bearerToken) h['Authorization'] = `Bearer ${bearerToken}`;
  if (apiKey) h['X-Api-Key'] = apiKey;

  // Only idempotent reads auto-retry. A mutation (payment) must NOT blind-resend
  // at the HTTP layer — that belongs to the offline queue with a dedupe key.
  const maxAttempts = idempotent ? Math.max(1, retries + 1) : 1;
  let lastErr: HttpError | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: h,
        body: body == null ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as T;
        return { status: res.status, data };
      }
      if (res.status >= 400 && res.status < 500) {
        throw new HttpError(res.status, 'client', `request failed (${res.status})`); // never retried
      }
      lastErr = new HttpError(res.status, 'server', `request failed (${res.status})`);
    } catch (e) {
      if (e instanceof HttpError) {
        if (e.code === 'client') throw e;
        lastErr = e;
      } else {
        const aborted = (e as Error)?.name === 'AbortError';
        lastErr = new HttpError(
          0,
          aborted ? 'timeout' : 'network',
          aborted ? 'request timed out' : 'network error',
        );
      }
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts - 1) await sleep(backoffDelayMs(attempt));
  }
  throw lastErr ?? new HttpError(0, 'network', 'request failed');
}
