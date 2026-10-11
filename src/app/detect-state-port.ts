import type { ProviderId } from '../domain/usage.js';

/** Persistence for the detector (#89): KV for per-detector state, cursors and probe budgets, plus a
 * single-run lease. Synchronous like the other stores. Callers keep values secret-free JSON. */
export interface DetectLease {
  readonly owner: string; readonly acquiredAtMs: number; readonly renewedAtMs: number; readonly expiresAtMs: number;
}
export type LeaseAcquire =
  | { readonly acquired: true; readonly lease: DetectLease; /** Previous holder after an expiry takeover. */ readonly takeover?: DetectLease }
  | { readonly acquired: false; readonly heldBy: DetectLease };
export interface DetectStateStore {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
  /** Succeeds when free, expired (takeover) or already ours (renews). */
  acquireLease(owner: string, nowMs: number, ttlMs: number): LeaseAcquire;
  /** Heartbeat: false when another owner took over (fenced); the caller must stop the cycle. */
  renewLease(owner: string, nowMs: number, ttlMs: number): boolean;
  releaseLease(owner: string): void;
  /** Read-only view for `detect status`. */
  getLease(): DetectLease | undefined;
  close(): void;
}

/** A lease that missed two intervals is dead. */
export const leaseTtlMs = (intervalMs: number): number => 2 * intervalMs;

const part = encodeURIComponent;
export const detectKeys = {
  usage: (provider: ProviderId, windowId: string, unit: string) => `usage:${provider}:${part(windowId)}:${part(unit)}`,
  probe: (provider: ProviderId, scope: string) => `probe:${provider}:${part(scope)}`,
  zen: (name: 'cursor' | 'retry-passed' | 'plugin-stale') => `zen:${name}`,
} as const;

const KEY = /^[A-Za-z0-9._:%@-]{1,200}$/;
export const MAX_STATE_VALUE_CHARS = 4096;
export function assertStateEntry(key: string, value?: string): void {
  if (!KEY.test(key) || (value !== undefined && value.length > MAX_STATE_VALUE_CHARS)) throw new RangeError('Invalid detect state entry');
}
export function assertLeaseArgs(owner: string, nowMs: number, ttlMs?: number): void {
  const time = (v: number) => Number.isSafeInteger(v) && v >= 0;
  if (!/^[A-Za-z0-9._:-]{1,64}$/.test(owner) || !time(nowMs) || (ttlMs !== undefined && (!time(ttlMs) || ttlMs === 0))) {
    throw new RangeError('Invalid detect lease arguments');
  }
}

/** Corrupt or unexpected JSON reads as "no state": the detector starts that signal fresh. */
export function readState<T>(store: DetectStateStore, key: string, guard: (value: unknown) => value is T): T | undefined {
  try { const parsed: unknown = JSON.parse(store.get(key) ?? 'null'); return guard(parsed) ? parsed : undefined; }
  catch { return undefined; }
}
export const writeState = (store: DetectStateStore, key: string, value: unknown): void => store.set(key, JSON.stringify(value));
