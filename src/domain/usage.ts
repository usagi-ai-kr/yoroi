export const providers = ['ollama-pro', 'opencode-go', 'codex', 'agy', 'claude', 'xai'] as const;
export type ProviderId = typeof providers[number];
export const defaultProviders = ['ollama-pro', 'opencode-go', 'codex', 'agy', 'claude', 'xai'] as const;
export type DefaultProviderId = typeof defaultProviders[number];
export interface UsageWindow {
  readonly id: string;
  readonly unit: string;
  readonly used?: number;
  readonly remaining?: number;
  readonly limit?: number;
  readonly percent?: number;
  readonly resetAt?: string;
  readonly periodStart?: string;
}
export interface UsageSnapshot {
  readonly provider: ProviderId;
  readonly observedAt: string;
  readonly windows: readonly UsageWindow[];
}
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}
export function createSnapshot(provider: ProviderId, observedAt: string,
  windows: readonly UsageWindow[]): UsageSnapshot {
  if (!providers.includes(provider) || !validDate(observedAt)) {
    throw new Error('Invalid usage snapshot');
  }
  const ids = new Set<string>();
  const copied = windows.map(window => {
    if (!window.id.trim() || !window.unit.trim() || ids.has(window.id)) {
      throw new Error('Invalid usage window identity');
    }
    ids.add(window.id);
    for (const key of ['used', 'remaining', 'limit', 'percent'] as const) {
      const value = window[key];
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new Error('Invalid usage metric');
      }
    }
    if ((window.percent !== undefined && window.percent > 100) ||
      (window.resetAt !== undefined && !validDate(window.resetAt)) ||
      (window.periodStart !== undefined && !validDate(window.periodStart))) {
      throw new Error('Invalid usage percent or reset time');
    }
    return Object.freeze({ ...window });
  });
  return Object.freeze({ provider, observedAt, windows: Object.freeze(copied) });
}
