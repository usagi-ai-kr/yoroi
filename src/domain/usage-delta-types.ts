export type UsageDeltaMetric = 'used' | 'remaining' | 'limit' | 'percent';
export type UsageDeltaUnavailableReason = 'no-previous' | 'identity-mismatch' |
  'period-mismatch' | 'reset-anomaly' | 'missing-metric' | 'invalid-time';
export type UsageDeltaResetReason = 'period-start-advanced' | 'reset-at-advanced';

/** Reason boundaries. 'reset': the period boundary moved forward (later periodStart/resetAt).
 * 'reset-anomaly': it moved backward or vanished. 'period-mismatch': the periods are known to
 * differ but the direction is not provable (e.g. one side lacks the field the other uses).
 * 'identity-mismatch' only occurs when a calculator is handed an arbitrary pair: the history
 * port matches provider/scope/contract/window/unit exactly, so a unit change shows up as
 * 'no-previous'. Derived at read time from latest minus previous real observation.
 * Never persist derived values as samples; cache hits do not change the pair.
 * Different provider/scope/contract/window/unit cannot be compared.
 * Missing metrics are omitted, never interpreted as zero. */
export type UsageDelta = {
  readonly status: 'delta';
  readonly observedAt: string;
  readonly previousObservedAt: string;
  readonly elapsedMs: number;
  /** Signed absolute differences; percent is percentage points (%p).
   * Other metrics retain the original window unit; never sum unlike units.
   * Must contain at least one key: an empty values object is 'n/a' / 'missing-metric'. */
  readonly values: Readonly<Partial<Record<UsageDeltaMetric, number>>>;
} | {
  readonly status: 'reset';
  readonly reason: UsageDeltaResetReason;
} | {
  readonly status: 'n/a';
  readonly reason: UsageDeltaUnavailableReason;
};
