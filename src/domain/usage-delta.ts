import type { ProviderId, UsageWindow } from './usage.js';
import type { UsageDelta, UsageDeltaMetric, UsageDeltaResetReason } from './usage-delta-types.js';

/** Minimal structural input matching the history port's UsageObservation,
 * defined here so domain never imports the app layer (dependency direction). */
export interface UsageDeltaObservation {
  readonly provider: ProviderId;
  readonly scope: string;
  readonly contractVersion: string;
  readonly observedAt: string;
  readonly window: UsageWindow;
}
export type UsageDeltaPair = readonly [] | readonly [UsageDeltaObservation] |
  readonly [UsageDeltaObservation, UsageDeltaObservation];

const METRICS = ['used', 'remaining', 'limit', 'percent'] as const;

type Boundary = 'advanced' | 'same' | 'anomaly' | 'mismatch' | 'absent';

function compareBoundary(current: string | undefined, previous: string | undefined): Boundary {
  if (current === undefined && previous === undefined) return 'absent';
  if (current !== undefined && previous !== undefined) {
    const c = Date.parse(current);
    const p = Date.parse(previous);
    if (c > p) return 'advanced';
    if (c < p) return 'anomaly';
    return 'same';
  }
  return current !== undefined ? 'mismatch' : 'anomaly';
}

function isIdentityMatch(latest: UsageDeltaObservation, previous: UsageDeltaObservation): boolean {
  return latest.provider === previous.provider &&
    latest.scope === previous.scope &&
    latest.contractVersion === previous.contractVersion &&
    latest.window.id === previous.window.id &&
    latest.window.unit === previous.window.unit;
}

function isValidTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function periodVerdict(latest: UsageDeltaObservation, previous: UsageDeltaObservation): UsageDelta | undefined {
  const resetAt = compareBoundary(latest.window.resetAt, previous.window.resetAt);
  const periodStart = compareBoundary(latest.window.periodStart, previous.window.periodStart);
  const boundaries = [resetAt, periodStart];
  if (boundaries.includes('anomaly')) return { status: 'n/a', reason: 'reset-anomaly' };
  if (boundaries.includes('advanced')) {
    const reason: UsageDeltaResetReason =
      resetAt === 'advanced' ? 'reset-at-advanced' : 'period-start-advanced';
    return { status: 'reset', reason };
  }
  if (boundaries.includes('mismatch')) return { status: 'n/a', reason: 'period-mismatch' };
  return undefined;
}

function computeValues(latest: UsageDeltaObservation, previous: UsageDeltaObservation):
  Partial<Record<UsageDeltaMetric, number>> {
  const values: Partial<Record<UsageDeltaMetric, number>> = {};
  for (const metric of METRICS) {
    const current = latest.window[metric];
    const prior = previous.window[metric];
    if (current !== undefined && prior !== undefined) values[metric] = current - prior;
  }
  return values;
}

/** Δ = latest − previous real observation. Pure: never queries a provider. */
export function computeUsageDelta(pair: UsageDeltaPair): UsageDelta {
  if (pair.length !== 2) return { status: 'n/a', reason: 'no-previous' };
  const [latest, previous] = pair as readonly [UsageDeltaObservation, UsageDeltaObservation];
  if (!isIdentityMatch(latest, previous)) return { status: 'n/a', reason: 'identity-mismatch' };
  const latestMs = Date.parse(latest.observedAt);
  const previousMs = Date.parse(previous.observedAt);
  if (!isValidTime(latest.observedAt) || !isValidTime(previous.observedAt) || latestMs <= previousMs) {
    return { status: 'n/a', reason: 'invalid-time' };
  }
  const period = periodVerdict(latest, previous);
  if (period !== undefined) return period;
  const values = computeValues(latest, previous);
  if (Object.keys(values).length === 0) return { status: 'n/a', reason: 'missing-metric' };
  return {
    status: 'delta',
    observedAt: latest.observedAt,
    previousObservedAt: previous.observedAt,
    elapsedMs: latestMs - previousMs,
    values,
  };
}
