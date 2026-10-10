import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot, type UsageSnapshot } from '../src/domain/usage.js';
import type { UsageDelta } from '../src/domain/usage-delta-types.js';
import { USAGE_CACHE_TTL_MS, type UsageCache, type UsageCacheKey } from '../src/app/usage-cache-port.js';
import { resultMeta, type MeteredUsageResult } from '../src/app/usage-result-meta.js';
import type { UsageHistory, UsageHistoryContext, UsageHistoryKey,
  UsageObservation, UsageObservationPair } from '../src/app/usage-history-port.js';

const start = Date.parse('2026-10-10T00:00:00.000Z');
const key: UsageCacheKey = { provider: 'claude', lookup: 'windows:all', scope: 'fixture-profile', contractVersion: 'fixture@1' };
const snapshot = (offset = 0) => createSnapshot('claude', new Date(start + offset).toISOString(),
  [{ id: '5h', unit: 'percent', percent: offset ? 24 : 20 }]);
const identity = (v: UsageCacheKey) => JSON.stringify([v.provider, v.lookup, v.scope, v.contractVersion]);
function fakeCache(): UsageCache {
  const rows = new Map<string, UsageSnapshot>();
  return {
    get(k, now) {
      const row = rows.get(identity(k));
      const age = row ? now - Date.parse(row.observedAt) : NaN;
      return age >= 0 && age < USAGE_CACHE_TTL_MS ? row : undefined;
    },
    set(k, row) { assert.equal(k.provider, row.provider); rows.set(identity(k), row); },
    prune(now) {
      const gone = [...rows].filter(([, row]) => now >= Date.parse(row.observedAt) + USAGE_CACHE_TTL_MS);
      gone.forEach(([k]) => rows.delete(k)); return gone.length;
    },
    close() {},
  };
}
const newest = (a: UsageObservation, b: UsageObservation) => Date.parse(b.observedAt) - Date.parse(a.observedAt);
const seriesOf = (r: UsageObservation) => JSON.stringify([r.provider, r.scope, r.contractVersion, r.window.id, r.window.unit]);
const seriesOfKey = (k: UsageHistoryKey) => JSON.stringify([k.provider, k.scope, k.contractVersion, k.windowId, k.unit]);
function fakeHistory(): UsageHistory {
  let rows: UsageObservation[] = [];
  return {
    record(s, context) {
      for (const window of s.windows) {
        const row = { ...context, provider: s.provider, observedAt: s.observedAt, window };
        if (!rows.some(r => seriesOf(r) === seriesOf(row) && r.observedAt === row.observedAt)) rows.push(row);
      }
    },
    latestTwo(k): UsageObservationPair {
      const [first, second] = rows.filter(row => seriesOf(row) === seriesOfKey(k)).sort(newest);
      return first ? second ? [first, second] : [first] : [];
    },
    prune(policy) {
      const count = rows.length, kept = new Map<string, number>();
      rows = rows.filter(row => Date.parse(row.observedAt) >= Date.parse(policy.before)).sort(newest)
        .filter(row => { const n = (kept.get(seriesOf(row)) ?? 0) + 1; kept.set(seriesOf(row), n);
          return n <= policy.maxSamples; });
      return count - rows.length;
    },
    close() {},
  };
}
test('sync cache contract: injected clock, TTL boundary, future and isolated keys', () => {
  const cache = fakeCache();
  assert.equal(cache.get(key, start), undefined); cache.set(key, snapshot());
  for (const offset of [0, 59_999]) assert.equal(cache.get(key, start + offset)?.observedAt, snapshot().observedAt);
  for (const offset of [-1, 60_000]) assert.equal(cache.get(key, start + offset), undefined);
  for (const changed of [{ scope: 'other' }, { contractVersion: 'fixture@2' },
    { lookup: 'window:5h' }, { provider: 'codex' as const }])
    assert.equal(cache.get({ ...key, ...changed }, start), undefined);
  assert.equal(cache.prune(start + 60_000), 1); cache.close();
});
test('history uses latest real pair, never records cache hits, and survives cache expiry', () => {
  const cache = fakeCache(), history = fakeHistory(), context: UsageHistoryContext = key;
  const query: UsageHistoryKey = { ...context, provider: key.provider, windowId: '5h', unit: 'percent' };
  assert.deepEqual(history.latestTwo(query), []);
  history.record(snapshot(1_000), context); history.record(snapshot(), context);
  history.record(snapshot(1_000), context); cache.set(key, snapshot(1_000));
  const before = history.latestTwo(query);
  assert.deepEqual(before.map(row => row.observedAt), [snapshot(1_000).observedAt, snapshot().observedAt]);
  assert.ok(cache.get(key, start + 2_000)); // App hit path performs no history.record.
  cache.prune(start + 61_000); assert.deepEqual(history.latestTwo(query), before);
  for (const changed of [{ scope: 'other' }, { contractVersion: 'fixture@2' },
    { unit: 'USD' }, { windowId: '7d' }, { provider: 'codex' as const }])
    assert.deepEqual(history.latestTwo({ ...query, ...changed }), []);
  const deltas: UsageDelta[] = [{ status: 'delta', observedAt: before[0]!.observedAt,
    previousObservedAt: before[1]!.observedAt, elapsedMs: 1_000, values: { percent: 4 } },
  { status: 'reset', reason: 'reset-at-advanced' }, { status: 'n/a', reason: 'no-previous' }];
  assert.deepEqual(deltas.map(value => value.status), ['delta', 'reset', 'n/a']);
  assert.equal(history.prune({ before: snapshot().observedAt, maxSamples: 1 }), 1);
  history.close(); cache.close();
});
test('history retention caps each series separately; result meta is additive', () => {
  const history = fakeHistory(), context: UsageHistoryContext = key;
  const at = (offset: number, id: string) => createSnapshot('claude', new Date(start + offset).toISOString(),
    [{ id, unit: 'percent', percent: 1 }]);
  for (const offset of [0, 1_000, 2_000]) history.record(at(offset, '5h'), context);
  history.record(at(-5_000, '7d'), context);
  assert.equal(history.prune({ before: new Date(start - 9_000).toISOString(), maxSamples: 2 }), 1);
  const query: UsageHistoryKey = { ...context, provider: 'claude', windowId: '7d', unit: 'percent' };
  assert.equal(history.latestTwo(query).length, 1);
  const plain = { provider: 'claude' as const, snapshot: snapshot() };
  const metered: MeteredUsageResult = { ...plain, meta: { cache: { hit: true, ageMs: 1_000 },
    deltas: { '5h': { status: 'n/a', reason: 'no-previous' } } } };
  assert.deepEqual([resultMeta(plain), resultMeta(metered)?.cache?.ageMs], [undefined, 1_000]);
});
