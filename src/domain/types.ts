import { providers } from './usage.js';
import type { ProviderId, UsageSnapshot, UsageWindow } from './usage.js';
import type { UsageDeltaMetric } from './usage-delta-types.js';
export type UsageMetricType = UsageDeltaMetric;
export type UsageWindowKey = `${ProviderId}:${string}`;
export type MetricValues = Readonly<Partial<Record<UsageMetricType, number>>>;
export type ReadonlySnapshot<TWindow extends UsageWindow = UsageWindow> = Readonly<{
  readonly provider: ProviderId;
  readonly observedAt: string;
  readonly windows: readonly Readonly<TWindow>[];
}>;
export interface PureWindowInput extends UsageWindow {}
export interface PureSnapshotInput {
  readonly provider: ProviderId;
  readonly observedAt: string;
  readonly windows: readonly UsageWindow[];
}
const METRICS: readonly UsageMetricType[] = ['used', 'remaining', 'limit', 'percent'];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
export function isUsageMetricType(value: unknown): value is UsageMetricType {
  return typeof value === 'string' && (METRICS as readonly string[]).includes(value);
}
export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (providers as readonly string[]).includes(value);
}
export function isUsageWindow(value: unknown): value is UsageWindow {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim()) return false;
  if (typeof value.unit !== 'string' || !value.unit.trim()) return false;
  for (const metric of METRICS) {
    const field = value[metric];
    if (field !== undefined && !isFiniteNonNegative(field)) return false;
  }
  if (typeof value.percent === 'number' && value.percent > 100) return false;
  if (value.resetAt !== undefined && typeof value.resetAt !== 'string') return false;
  if (value.periodStart !== undefined && typeof value.periodStart !== 'string') return false;
  return true;
}
export function isUsageSnapshot(value: unknown): value is UsageSnapshot {
  if (!isRecord(value)) return false;
  if (!isProviderId(value.provider) || typeof value.observedAt !== 'string') return false;
  if (!Array.isArray(value.windows)) return false;
  return (value.windows as unknown[]).every(isUsageWindow);
}
export function createWindowKey(provider: ProviderId, windowId: string): UsageWindowKey {
  if (!isProviderId(provider) || !windowId.trim()) throw new Error('Invalid window key');
  return `${provider}:${windowId}` as UsageWindowKey;
}
export function freezeSnapshot(input: PureSnapshotInput): ReadonlySnapshot {
  const windows = input.windows.map((window) => Object.freeze({ ...window }));
  return Object.freeze({ provider: input.provider, observedAt: input.observedAt, windows: Object.freeze(windows) });
}
