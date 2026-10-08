import type { ProviderId, UsageSnapshot } from '../domain/usage.js';
import type { UsageResult } from './usage-source.js';

export type CollectionEventName =
  'usage.collected' | 'usage.partial' | 'usage.failed' | 'usage.empty' |
  'auth.expired' | 'usage.resetChanged';
export interface CollectionEvent {
  readonly name: CollectionEventName;
  readonly provider?: ProviderId;
  readonly at: string;
  readonly succeeded?: number;
  readonly failed?: number;
  readonly windowId?: string;
  readonly errorCode?: 'authentication';
  readonly resetAt?: string;
}
export type PreviousSnapshots = ReadonlyMap<string, UsageSnapshot>;
type Summary = { name: CollectionEventName; succeeded: number; failed: number };

/** 결과 구성이 요약 이벤트 하나를 정한다: 전부 성공·혼재·전부 실패·결과 없음. */
function summary(results: readonly UsageResult[]): Summary {
  let succeeded = 0;
  for (const result of results) if ('snapshot' in result) succeeded += 1;
  const failed = results.length - succeeded;
  const name: CollectionEventName = results.length === 0 ? 'usage.empty' :
    succeeded === 0 ? 'usage.failed' : failed === 0 ? 'usage.collected' : 'usage.partial';
  return { name, succeeded, failed };
}

function resetChanges(provider: ProviderId, previous: UsageSnapshot,
  current: UsageSnapshot, at: string): CollectionEvent[] {
  const oldById = new Map(previous.windows.map(window => [window.id, window.resetAt]));
  const events: CollectionEvent[] = [];
  for (const window of current.windows) {
    const oldReset = oldById.get(window.id);
    if (oldReset !== undefined && window.resetAt !== undefined && oldReset !== window.resetAt) {
      events.push({ name: 'usage.resetChanged', provider, at, windowId: window.id,
        resetAt: window.resetAt });
    }
  }
  return events;
}

export function buildCollectionEvents(results: readonly UsageResult[], at: string,
  previous?: PreviousSnapshots): readonly CollectionEvent[] {
  const { name, succeeded, failed } = summary(results);
  const events: CollectionEvent[] = [{ name, at, succeeded, failed }];
  for (const result of results) {
    if ('error' in result && result.error.code === 'authentication') {
      events.push({ name: 'auth.expired', provider: result.provider, at, errorCode: 'authentication' });
    }
  }
  if (previous === undefined) return events;
  for (const result of results) {
    if (!('snapshot' in result)) continue;
    const old = previous.get(result.provider);
    if (old !== undefined) events.push(...resetChanges(result.provider, old, result.snapshot, at));
  }
  return events;
}