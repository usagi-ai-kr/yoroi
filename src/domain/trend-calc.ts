import type { ProviderId, UsageWindow } from './usage.js';

export interface TrendObservation {
  readonly provider: ProviderId;
  readonly scope: string;
  readonly contractVersion: string;
  readonly observedAt: string;
  readonly window: UsageWindow;
}

export type TrendPeriod = '24h' | '7d' | '30d';

export interface TrendPeriodStats {
  period: TrendPeriod;
  sampleCount: number;
  first?: { at: string; value: number };
  last?: { at: string; value: number };
  delta: number | null;
  ratePerHour: number | null;
  resets: number;
  gaps: number;
  /** True when measured gaps cover at least half the period: the rate is shown as a rough value only. */
  gapWarning?: boolean;
  status: 'sufficient' | 'insufficient' | 'empty';
}

const PERIOD_MS: Record<TrendPeriod, number> = {
  '24h': 24 * 3600 * 1000,
  '7d': 7 * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

function extractVal(obs: TrendObservation): number | null {
  const w = obs.window;
  if (w.unit === '%' || w.unit === 'percent' || w.percent !== undefined) return w.percent ?? null;
  return w.used ?? w.remaining ?? null;
}

export function filterByPeriod(samples: readonly TrendObservation[], p: TrendPeriod, now = Date.now()) {
  const cutoff = now - PERIOD_MS[p];
  return samples
    .filter(s => {
      const ms = Date.parse(s.observedAt);
      return Number.isFinite(ms) && ms >= cutoff && ms <= now;
    })
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
}

function countResetsAndGaps(samples: readonly TrendObservation[], maxGapMs = 4 * 3600 * 1000) {
  let resets = 0, gaps = 0, gapMs = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i - 1]!.window.resetAt !== samples[i]!.window.resetAt) resets++;
    const span = Date.parse(samples[i]!.observedAt) - Date.parse(samples[i - 1]!.observedAt);
    if (span > maxGapMs) { gaps++; gapMs += span; }
  }
  return { resets, gaps, gapMs };
}

function latestSegment(samples: readonly TrendObservation[]): TrendObservation[] {
  let start = 0;
  for (let i = 1; i < samples.length; i++) {
    const [p, c] = [samples[i - 1]!, samples[i]!];
    if (p.window.resetAt !== c.window.resetAt || p.window.unit !== c.window.unit ||
        p.contractVersion !== c.contractVersion) start = i;
  }
  return samples.slice(start);
}

export function computeTrendStats(
  samples: readonly TrendObservation[],
  period: TrendPeriod,
  nowMs = Date.now(),
): TrendPeriodStats {
  const inWindow = filterByPeriod(samples, period, nowMs);
  if (inWindow.length === 0) {
    return { period, sampleCount: 0, delta: null, ratePerHour: null, resets: 0, gaps: 0, status: 'empty' };
  }
  const { resets, gaps, gapMs } = countResetsAndGaps(inWindow);
  const gapWarning = gaps > 0 && gapMs >= PERIOD_MS[period] / 2;
  const values = latestSegment(inWindow)
    .map(s => ({ at: s.observedAt, value: extractVal(s) }))
    .filter((v): v is { at: string; value: number } => v.value !== null);

  if (values.length < 2) {
    return {
      period, sampleCount: inWindow.length, resets, gaps, gapWarning, status: 'insufficient',
      delta: null, ratePerHour: null,
      ...(values[0] && { first: values[0] }),
      ...(values[values.length - 1] && { last: values[values.length - 1] }),
    };
  }

  const [first, last] = [values[0]!, values[values.length - 1]!];
  const delta = Math.round((last.value - first.value) * 1000) / 1000;
  const elapsedH = (Date.parse(last.at) - Date.parse(first.at)) / (3600 * 1000);
  const ratePerHour = elapsedH > 0 ? Math.round((delta / elapsedH) * 1000) / 1000 : null;

  return { period, sampleCount: inWindow.length, first, last, delta, ratePerHour, resets, gaps, gapWarning, status: 'sufficient' };
}
