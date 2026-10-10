import type { ProviderId, UsageSnapshot, UsageWindow } from '../domain/usage.js';

/** scope/contractVersion are non-secret profile and parser identifiers
 * (scope matches /^[A-Za-z0-9._:@-]{1,64}$/; adapters reject anything else). */
export interface UsageHistoryContext {
  readonly scope: string;
  readonly contractVersion: string;
}
export interface UsageHistoryKey extends UsageHistoryContext {
  readonly provider: ProviderId;
  readonly windowId: string;
  readonly unit: string;
}
export interface UsageObservation extends UsageHistoryContext {
  readonly provider: ProviderId;
  readonly observedAt: string;
  readonly window: UsageWindow;
}
/** Newest first, distinct observation times, never insertion order. */
export type UsageObservationPair = readonly [] | readonly [UsageObservation] |
  readonly [UsageObservation, UsageObservation];
export interface UsageHistoryRetention {
  /** Remove observations strictly older than this UTC ISO timestamp. */
  readonly before: string;
  /** Positive integer cap applied PER SERIES (provider, scope, contractVersion, windowId, unit),
   * newest first. Never a global cap: it would evict slowly updated windows entirely. */
  readonly maxSamples: number;
}
/** All methods are synchronous and must never query an external provider. */
export interface UsageHistory {
  /** Call only after actual successful collection, never a cache hit.
   * Record each window; duplicate key + observedAt is an idempotent no-op.
   * Persistence errors may throw; they must not trigger provider re-collection. */
  record(snapshot: UsageSnapshot, context: UsageHistoryContext): void;
  /** Match all key fields exactly; return latest and previous real samples.
   * Cache hits compute the same pair, not current minus itself. */
  latestTwo(key: UsageHistoryKey): UsageObservationPair;
  /** Prune history only, independent of cache TTL; return rows removed. */
  prune(retention: UsageHistoryRetention): number;
  /** Release owned resources only; borrowed shared connections remain open. */
  close(): void;
}
