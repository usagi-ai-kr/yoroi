import type { ProviderId, UsageSnapshot } from '../domain/usage.js';
import type { UsageResult } from './usage-source.js';

export type CollectionEventName =
  'usage.collected' | 'usage.partial' | 'auth.expired' | 'usage.resetChanged';
export interface CollectionEvent {
  readonly name: CollectionEventName;
  readonly provider?: ProviderId;
  readonly at: string;
  readonly errorCode?: 'authentication';
  readonly resetAt?: string;
}
export type PreviousSnapshots = ReadonlyMap<string, UsageSnapshot>;

function resetChanges(provider: ProviderId, previous: UsageSnapshot,
  current: UsageSnapshot, at: string): CollectionEvent[] {
  const oldById = new Map(previous.windows.map(window => [window.id, window.resetAt]));
  const events: CollectionEvent[] = [];
  for (const window of current.windows) {
    const oldReset = oldById.get(window.id);
    if (oldReset !== undefined && window.resetAt !== undefined && oldReset !== window.resetAt) {
      events.push({ name: 'usage.resetChanged', provider, at, resetAt: window.resetAt });
    }
  }
  return events;
}

export function buildCollectionEvents(results: readonly UsageResult[], at: string,
  previous?: PreviousSnapshots): readonly CollectionEvent[] {
  const events: CollectionEvent[] = [];
  let failed = false;
  for (const result of results) {
    if (!('error' in result)) continue;
    failed = true;
    if (result.error.code === 'authentication') {
      events.push({ name: 'auth.expired', provider: result.provider, at, errorCode: 'authentication' });
    }
  }
  events.unshift({ name: failed ? 'usage.partial' : 'usage.collected', at });
  if (previous === undefined) return events;
  for (const result of results) {
    if (!('snapshot' in result)) continue;
    const old = previous.get(result.provider);
    if (old !== undefined) events.push(...resetChanges(result.provider, old, result.snapshot, at));
  }
  return events;
}
