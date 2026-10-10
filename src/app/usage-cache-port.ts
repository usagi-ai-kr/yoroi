import type { ProviderId, UsageSnapshot } from '../domain/usage.js';

export const USAGE_CACHE_TTL_MS = 60_000;
/** Epoch milliseconds; callers/adapters may inject a fake clock. */
export type UsageClock = () => number;

/** All fields are non-secret identifiers, never credentials or response text.
 * scope must match /^[A-Za-z0-9._:@-]{1,64}$/; adapters reject anything else.
 * Adapters MUST encode the four fields injectively (e.g. a JSON array): joining with ':'
 * is ambiguous because lookup/scope may contain ':'. */
export interface UsageCacheKey {
  readonly provider: ProviderId;
  readonly lookup: string;
  readonly scope: string;
  readonly contractVersion: string;
}

/** Synchronous persistence only: no provider calls, retries or history writes. */
export interface UsageCache {
  /** Hit iff observedAt <= now < observedAt + TTL; preserve observedAt.
   * Invalid timestamps, absent/expired/future rows are misses (undefined).
   * A corrupt row (bad JSON or failing createSnapshot) is a miss too; delete it if possible.
   * Storage errors may throw; once/watch must treat them as misses. */
  get(key: UsageCacheKey, now: number): UsageSnapshot | undefined;
  /** Successful normalized snapshots only; provider must match key.provider.
   * Expiry derives from observedAt, never the insertion time. */
  set(key: UsageCacheKey, snapshot: UsageSnapshot): void;
  /** Delete expired cache rows only; return the number removed. */
  prune(now: number): number;
  /** Release owned resources only; never close a borrowed shared connection. */
  close(): void;
}
