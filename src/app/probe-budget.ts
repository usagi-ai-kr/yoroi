import type { ProviderId } from '../domain/usage.js';
import { parseRetryAfter } from '../domain/retry-after.js';

const MINUTE = 60_000;
export const DEFAULT_PROBE_INTERVALS: Readonly<Record<ProviderId, number>> = Object.freeze({
  claude: 30 * MINUTE, 'ollama-pro': 15 * MINUTE, 'opencode-go': 15 * MINUTE,
  codex: 30 * MINUTE, agy: 30 * MINUTE, xai: 30 * MINUTE,
});
/** Persist one state per provider and credential scope. No timers or credentials are held here. */
export interface ProbeBudgetState {
  readonly lastAttemptAtMs?: number;
  readonly cooldownUntilMs?: number;
  readonly consecutiveFailures: number;
}
export const INITIAL_PROBE_STATE: ProbeBudgetState = Object.freeze({ consecutiveFailures: 0 });
export interface ProbeDecision {
  readonly allowed: boolean;
  readonly reason: 'due' | 'fresh-sample' | 'interval' | 'cooldown';
  readonly nextProbeAtMs: number;
}
export type ProbeOutcome = 'success' | 'rate-limited' | 'unavailable' | 'failed';
function validTime(value: number): boolean { return Number.isSafeInteger(value) && value >= 0; }
function validate(state: ProbeBudgetState, nowMs: number): void {
  if (![nowMs, state.consecutiveFailures, state.lastAttemptAtMs ?? 0, state.cooldownUntilMs ?? 0].every(validTime)) {
    throw new RangeError('Invalid probe budget state or clock');
  }
}
// Saturation keeps oversized Retry-After values conservative and JSON-safe (Infinity becomes null in JSON).
function after(nowMs: number, delayMs: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, nowMs + delayMs);
}
/** Call every detection cycle; skip all provider work (including credential lookup) when denied.
 * sampleAtMs is the latest real observation, including a manual once sample, never cache access time. */
export function decideProbe(provider: ProviderId, state: ProbeBudgetState, nowMs: number,
  sampleAtMs?: number, intervals: Partial<Record<ProviderId, number>> = {}): ProbeDecision {
  validate(state, nowMs);
  const interval = intervals[provider] ?? DEFAULT_PROBE_INTERVALS[provider];
  if (!validTime(interval) || interval === 0 || (sampleAtMs !== undefined && !validTime(sampleAtMs))) {
    throw new RangeError('Invalid probe interval or sample time');
  }
  const sampleDue = sampleAtMs !== undefined && sampleAtMs <= nowMs ? after(sampleAtMs, interval) : 0;
  const attemptDue = state.lastAttemptAtMs === undefined ? 0 : after(state.lastAttemptAtMs, interval);
  const cooldownDue = state.cooldownUntilMs ?? 0;
  const nextProbeAtMs = Math.max(sampleDue, attemptDue, cooldownDue);
  if (nextProbeAtMs <= nowMs) return { allowed: true, reason: 'due', nextProbeAtMs: nowMs };
  const reason = nextProbeAtMs === cooldownDue ? 'cooldown'
    : nextProbeAtMs === sampleDue ? 'fresh-sample' : 'interval';
  return { allowed: false, reason, nextProbeAtMs };
}
/** Persist before dispatch so a restart or non-retryable failure cannot bypass the interval. */
export function recordProbeAttempt(state: ProbeBudgetState, nowMs: number): ProbeBudgetState {
  validate(state, nowMs);
  return { ...state, lastAttemptAtMs: nowMs };
}
/** Retry-After overrides the exponential cooldown, but never bypasses the provider interval.
 * Only rate limits/unavailable extend cooldown: 15, 30, 60 minutes, capped at 60. */
export function recordProbeResult(state: ProbeBudgetState, outcome: ProbeOutcome, nowMs: number,
  retryAfter?: string): ProbeBudgetState {
  validate(state, nowMs);
  const lastAttemptAtMs = state.lastAttemptAtMs ?? nowMs;
  if (outcome === 'success' || outcome === 'failed') return { lastAttemptAtMs, consecutiveFailures: 0 };
  const consecutiveFailures = Math.min(Number.MAX_SAFE_INTEGER, state.consecutiveFailures + 1);
  const delay = parseRetryAfter(retryAfter, nowMs) ?? 15 * MINUTE * 2 ** Math.min(2, consecutiveFailures - 1);
  return { lastAttemptAtMs, consecutiveFailures, cooldownUntilMs: after(nowMs, delay) };
}
