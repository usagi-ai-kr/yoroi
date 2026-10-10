import type { UsageDelta } from '../domain/usage-delta-types.js';
import type { UsageResult, UsageSource } from './usage-source.js';

/** Non-secret identity supplied by composition (never derived from credential contents).
 * scope: profile/config label matching /^[A-Za-z0-9._:@-]{1,64}$/; contractVersion: parser version. */
export interface UsageSourceIdentity {
  readonly scope: string;
  readonly contractVersion: string;
}
/** A UsageSource that opts in to caching and history by exposing its identity. */
export type IdentifiedUsageSource = UsageSource & { readonly identity: UsageSourceIdentity };

export interface UsageCacheMeta {
  /** True only when the snapshot came from the cache instead of a fresh collection. */
  readonly hit: boolean;
  /** now - snapshot.observedAt in milliseconds (>= 0 for hits). */
  readonly ageMs: number;
}
/** Optional display metadata; absent means "no cache/history information available". */
export interface UsageResultMeta {
  readonly cache?: UsageCacheMeta;
  /** Keyed by UsageWindow.id (unique within a snapshot); the unit is part of the history key. */
  readonly deltas?: Readonly<Record<string, UsageDelta>>;
}
/** Additive: a plain UsageResult stays assignable both ways, so usage-source.ts is unchanged. */
export type MeteredUsageResult = UsageResult & { readonly meta?: UsageResultMeta };

export function resultMeta(result: UsageResult): UsageResultMeta | undefined {
  return (result as MeteredUsageResult).meta;
}
