import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot } from '../src/domain/usage.js';
import { SourceError, type UsageResult } from '../src/app/usage-source.js';
import { buildCollectionEvents } from '../src/app/collection-events.js';

const at = '2026-10-08T00:00:00Z';
const ok = (provider: 'codex' | 'agy' | 'claude', resetAt = '2026-10-15T00:00:00Z') => ({
  provider, snapshot: createSnapshot(provider, at,
    [{ id: 'weekly', unit: 'requests', percent: 30, resetAt }]),
});
const err = (provider: 'codex' | 'agy' | 'claude', code: 'authentication' | 'timeout' = 'timeout') => ({
  provider, error: new SourceError(code),
});
const summaryOf = (results: readonly UsageResult[]) => buildCollectionEvents(results, at)[0]!;

test('all success is usage.collected with succeeded and failed counts', () => {
  assert.deepEqual(summaryOf([ok('codex'), ok('agy')]),
    { name: 'usage.collected', at, succeeded: 2, failed: 0 });
});

test('mixed success and failure is usage.partial with both counts', () => {
  assert.deepEqual(summaryOf([ok('codex'), err('agy'), ok('claude')]),
    { name: 'usage.partial', at, succeeded: 2, failed: 1 });
});

test('all failure is usage.failed and authentication stays provider scoped', () => {
  const events = buildCollectionEvents([err('codex'), err('agy', 'authentication')], at);

  assert.deepEqual(events[0], { name: 'usage.failed', at, succeeded: 0, failed: 2 });
  assert.deepEqual(events.slice(1), [
    { name: 'auth.expired', provider: 'agy', at, errorCode: 'authentication' },
  ]);
});

test('no results at all is usage.empty', () => {
  assert.deepEqual(summaryOf([]), { name: 'usage.empty', at, succeeded: 0, failed: 0 });
});

test('resetChanged carries windowId for every changed window', () => {
  const snapshot = createSnapshot('codex', at, [
    { id: 'weekly', unit: 'requests', percent: 30, resetAt: '2026-10-15T00:00:00Z' },
    { id: 'monthly', unit: 'requests', percent: 5, resetAt: '2026-11-01T00:00:00Z' },
  ]);
  const previous = new Map([['codex', snapshot]]);
  const changed = createSnapshot('codex', at, [
    { id: 'weekly', unit: 'requests', percent: 31, resetAt: '2026-10-22T00:00:00Z' },
    { id: 'monthly', unit: 'requests', percent: 6, resetAt: '2026-11-15T00:00:00Z' },
  ]);
  const events = buildCollectionEvents([{ provider: 'codex', snapshot: changed }], at, previous);

  assert.deepEqual(events.slice(1), [
    { name: 'usage.resetChanged', provider: 'codex', at, windowId: 'weekly',
      resetAt: '2026-10-22T00:00:00Z' },
    { name: 'usage.resetChanged', provider: 'codex', at, windowId: 'monthly',
      resetAt: '2026-11-15T00:00:00Z' },
  ]);
  const same = buildCollectionEvents([{ provider: 'codex', snapshot }], at, previous);
  assert.deepEqual(same, [{ name: 'usage.collected', at, succeeded: 1, failed: 0 }]);
});

test('events carry no secrets, raw usage values, or estimates', () => {
  const events = buildCollectionEvents(
    [ok('codex'), err('agy', 'authentication')], at,
    new Map([['codex', ok('codex').snapshot]]));
  const raw = JSON.stringify(events);

  for (const banned of ['windows', 'snapshot', 'percent', 'used', 'estimate', 'token', 'key']) {
    assert.ok(!raw.includes(`"${banned}"`), banned);
  }
  const allowed = ['name', 'provider', 'at', 'succeeded', 'failed', 'windowId',
    'errorCode', 'resetAt'];
  for (const event of events) {
    for (const key of Object.keys(event)) assert.ok(allowed.includes(key), key);
  }
});