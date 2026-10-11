import { parseRetryAfter } from './retry-after.js';

/** Rate-limit metadata carried alongside a normalized source error.
 *
 * `SourceError` lives in the app layer and stays unchanged, so adapters attach this
 * plain marker instead of widening the error class. The value is a delay in
 * milliseconds only — never a header string, credential, path or response body. */
export interface RateLimited {
  readonly retryAfterMs: number;
}

const RATE_LIMITED = 'retryAfterMs';
/** Longest server-requested wait that is honoured. A larger or non-finite Retry-After is capped here, never
 * dropped (that would turn "wait very long" into a short retry). */
export const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;

/** Mark an error as rate limited with a server-suggested delay (Retry-After, already parsed). */
export function markRateLimited<E extends Error>(error: E, retryAfterMs: number): E & RateLimited {
  if (!Number.isSafeInteger(retryAfterMs) || retryAfterMs < 0) {
    throw new RangeError('Invalid rate-limit delay');
  }
  Object.defineProperty(error, RATE_LIMITED, { value: retryAfterMs, enumerable: false, writable: false });
  return error as E & RateLimited;
}

/** Read the delay from a marked error, or undefined for anything unmarked/malformed. */
export function rateLimitDelayMs(error: unknown): number | undefined {
  const value = (error as Partial<RateLimited> | null | undefined)?.[RATE_LIMITED];
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/** Retry-After seconds as probe-budget expects it (`parseRetryAfter` accepts /^\d+$/).
 * Sub-second values round up to 1s so a retry is never scheduled before the server asked. */
export function retryAfterSeconds(delayMs: number | undefined): string | undefined {
  return delayMs === undefined ? undefined : String(Math.min(MAX_RETRY_AFTER_MS / 1000, Math.max(1, Math.ceil(delayMs / 1000))));
}

/** Attach the server's Retry-After to a normalized error. Existing codes are untouched; when the header is
 * absent or unparsable the error is returned unchanged so behaviour without the header stays exactly as before.
 * The marker only ever carries a finite delay of at most MAX_RETRY_AFTER_MS (delay 0 is kept; an oversized
 * or infinite value becomes the cap), so this never throws and never changes the SourceError the adapter raises. */
export function withRetryAfter(error: Error, headers: Readonly<Record<string, string>>,
  nowMs: number): Error {
  const key = Object.keys(headers).find(name => name.toLowerCase() === 'retry-after');
  const delay = key === undefined ? undefined : parseRetryAfter(headers[key], nowMs);
  if (delay === undefined) return error;
  return markRateLimited(error, Number.isFinite(delay) ? Math.min(delay, MAX_RETRY_AFTER_MS) : MAX_RETRY_AFTER_MS);
}
