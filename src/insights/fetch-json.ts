import { SourceError } from '../app/usage-source.js';
import type { HttpClient, HttpRequest } from '../infra/http-client.js';

/** JSON request description. Header values may hold credentials and are never logged. */
export interface JsonFetchSpec {
  readonly url: string;
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}

/** 429 means rate limited, 5xx upstream failure; other non-2xx stay unavailable. */
function statusError(status: number): SourceError {
  if (status === 401 || status === 403) return new SourceError('authentication');
  return new SourceError('unavailable');
}

/** Fetches one JSON document through an injected HttpClient (no real network here).
 * 429/5xx are classified as SourceError; the response body and headers are never logged. */
export async function fetchJson(client: HttpClient, spec: JsonFetchSpec,
  signal?: AbortSignal): Promise<unknown> {
  if (signal?.aborted) throw new SourceError('cancelled');
  const request: HttpRequest = { method: spec.method ?? 'GET', url: spec.url, timeoutMs: spec.timeoutMs,
    ...(spec.headers !== undefined ? { headers: { ...spec.headers } } : {}) };
  const response = await client.request(request, signal);
  if (response.status < 200 || response.status >= 300) throw statusError(response.status);
  try { return JSON.parse(response.body) as unknown; }
  catch { throw new SourceError('parse'); }
}
