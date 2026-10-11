import type { ProviderId, UsageWindow } from '../domain/usage.js';
import { computeUsageDelta } from '../domain/usage-delta.js';

/** One normalized sample of a single (provider, window, unit) series. */
export interface UsageSample { readonly provider: ProviderId; readonly observedAt: string; readonly window: UsageWindow }
export interface UsageDetectThresholds {
  /** Minimum percentage-point rise between two real samples to call a surge. */
  readonly surgePercentPoints: number;
  /** A sample older than this at `now` is stale. */
  readonly staleAfterMs: number;
  /** resetAt must advance by more than this to count as a new period (rolling windows drift). Default 60s. */
  readonly resetToleranceMs?: number;
}
/** Persisted between cycles; plain data (no secrets). A different provider/window/unit starts fresh. */
export interface UsageDetectState {
  readonly provider: ProviderId; readonly windowId: string; readonly unit: string;
  readonly exhausted: boolean; readonly stale: boolean;
  readonly exhaustedResetAt?: string; readonly surgeAt?: string;
}
/** Closed field set: numbers, ids and times only; never window extras, headers or credentials. */
export interface UsageDetectEvent {
  readonly kind: 'exhausted' | 'recovered' | 'surge' | 'stale' | 'resumed';
  readonly provider: ProviderId; readonly windowId: string; readonly unit: string; readonly observedAt: string;
  readonly percent?: number; readonly remaining?: number; readonly resetAt?: string;
  readonly reason?: 'value-dropped' | 'reset-advanced';
  readonly deltaPercent?: number; readonly elapsedMs?: number; readonly ageMs?: number;
}
export interface UsageDetectResult { readonly events: readonly UsageDetectEvent[]; readonly state: UsageDetectState }

const ms = (value?: string): number => (value === undefined ? Number.NaN : Date.parse(value));
const positive = (value: number): boolean => Number.isFinite(value) && value > 0;
const isExhausted = (w: UsageWindow): boolean => w.remaining === 0 || (w.percent !== undefined && w.percent >= 100);
const observation = (s: UsageSample) => ({ provider: s.provider, scope: 'detect', contractVersion: 'detect',
  observedAt: s.observedAt, window: s.window });

/** Pure transition function: events are returned only when a signal changes state (normal → alert → release);
 * surge fires once per sample. Exhaustion persists across cycles; a new period that is already exhausted is
 * treated as continuous exhaustion (no alert flood). Different window/unit pairs are never compared. */
export function evaluateUsage(input: { latest: UsageSample; previous?: UsageSample; state?: UsageDetectState;
  now: number; thresholds: UsageDetectThresholds }): UsageDetectResult {
  const { latest, previous, now, thresholds: t } = input, w = latest.window, at = ms(latest.observedAt);
  if (!positive(t.surgePercentPoints) || !positive(t.staleAfterMs)) throw new RangeError('Invalid usage detect thresholds');
  const s = input.state;
  const known = s !== undefined && s.provider === latest.provider && s.windowId === w.id && s.unit === w.unit;
  let { exhausted, stale, exhaustedResetAt, surgeAt } = known ? s : { exhausted: false, stale: false } as Partial<UsageDetectState> & { exhausted: boolean; stale: boolean };
  const done = (events: UsageDetectEvent[]): UsageDetectResult => ({ events, state: { provider: latest.provider,
    windowId: w.id, unit: w.unit, exhausted, stale, ...(exhaustedResetAt && { exhaustedResetAt }), ...(surgeAt && { surgeAt }) } });
  if (!Number.isFinite(at)) return done([]);
  const base = { provider: latest.provider, windowId: w.id, unit: w.unit, observedAt: latest.observedAt };
  const metrics = { ...(w.percent !== undefined && { percent: w.percent }),
    ...(w.remaining !== undefined && { remaining: w.remaining }), ...(w.resetAt !== undefined && { resetAt: w.resetAt }) };
  const events: UsageDetectEvent[] = [];
  const advanced = ms(w.resetAt) - ms(exhaustedResetAt) > (t.resetToleranceMs ?? 60_000);
  if (isExhausted(w)) {
    if (!exhausted) events.push({ kind: 'exhausted', ...base, ...metrics });
    if (!exhausted || advanced) exhaustedResetAt = w.resetAt;
    exhausted = true;
  } else if (exhausted) {
    events.push({ kind: 'recovered', ...base, ...metrics, reason: advanced ? 'reset-advanced' : 'value-dropped' });
    exhausted = false; exhaustedResetAt = undefined;
  }
  if (previous && previous.provider === latest.provider && previous.window.id === w.id &&
    previous.window.unit === w.unit && latest.observedAt !== surgeAt) {
    const delta = computeUsageDelta([observation(latest), observation(previous)]);
    const rise = delta.status === 'delta' ? delta.values.percent : undefined;
    if (delta.status === 'delta' && rise !== undefined && rise >= t.surgePercentPoints) {
      events.push({ kind: 'surge', ...base, ...metrics, deltaPercent: rise, elapsedMs: delta.elapsedMs });
      surgeAt = latest.observedAt;
    }
  }
  if (Number.isFinite(now)) {
    const age = now - at;
    if (age > t.staleAfterMs && !stale) { events.push({ kind: 'stale', ...base, ageMs: age }); stale = true; }
    else if (age <= t.staleAfterMs && stale) { events.push({ kind: 'resumed', ...base }); stale = false; }
  }
  return done(events);
}
