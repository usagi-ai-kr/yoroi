import assert from 'node:assert/strict';
import test from 'node:test';
import { CachedSource } from '../src/app/cached-source.js';
import type { UsageCache } from '../src/app/usage-cache-port.js';
import type { UsageHistory } from '../src/app/usage-history-port.js';
import { SourceError, type UsageSource } from '../src/app/usage-source.js';
import { createSnapshot, type UsageSnapshot } from '../src/domain/usage.js';

const observedAt = '2026-01-01T00:00:00.000Z';
const snapshot = createSnapshot('claude', observedAt, [{ id: '5h', unit: '%', percent: 20 }]);
const key = { provider: 'claude', lookup: 'windows:all', scope: 'test', contractVersion: 'v1' } as const;
function setup(refresh = false) {
  let reads = 0, gets = 0, sets = 0, records = 0, pairs = 0, hit: UsageSnapshot | undefined;
  let now = Date.parse(observedAt) + 1000;
  const source: UsageSource = { provider: 'claude', async read() { reads++; return snapshot; } };
  const cache: UsageCache = { get() { gets++; return hit; }, set() { sets++; }, prune() { return 0; }, close() {} };
  const history: UsageHistory = { record() { records++; }, prune() { return 0; }, close() {},
    latestTwo(k) { pairs++; assert.deepEqual(k, { ...key, windowId: '5h', unit: '%' }); return []; } };
  const wrapped = new CachedSource(source, { cache, history, key, clock: () => now, refresh });
  return { source, cache, history, wrapped, hit: (value?: UsageSnapshot) => { hit = value; }, time: (value: number) => { now = value; },
    counts: () => ({ reads, gets, sets, records, pairs }) };
}
test('hit preserves observation and never reads or records; age and delta are exposed', async () => {
  const h = setup(); h.hit(snapshot);
  assert.equal(await h.wrapped.read(), snapshot);
  assert.deepEqual(h.counts(), { reads: 0, gets: 1, sets: 0, records: 0, pairs: 1 });
  assert.deepEqual(h.wrapped.meta?.cache, { hit: true, ageMs: 1000 });
  assert.deepEqual(h.wrapped.meta?.deltas?.['5h'], { status: 'n/a', reason: 'no-previous' });
});
test('miss writes once and computes delta after recording', async () => {
  const h = setup(); h.history.latestTwo = () => { assert.equal(h.counts().records, 1); return [{ ...key, observedAt, window: snapshot.windows[0]! },
    { ...key, observedAt: '2025-12-31T23:59:00Z', window: { id: '5h', unit: '%', percent: 15 } }] as const; };
  assert.equal(await h.wrapped.read(), snapshot);
  assert.deepEqual(h.counts(), { reads: 1, gets: 1, sets: 1, records: 1, pairs: 0 });
  assert.deepEqual(h.wrapped.meta?.cache, { hit: false, ageMs: 1000 });
  const delta = h.wrapped.meta?.deltas?.['5h'];
  assert.equal(delta?.status, 'delta'); if (delta?.status === 'delta') assert.equal(delta.values.percent, 5);
});
test('refresh bypasses get even when it could hit', async () => {
  const h = setup(true); h.cache.get = () => { throw Error('must not read'); };
  await h.wrapped.read(); assert.deepEqual(h.counts(), { reads: 1, gets: 0, sets: 1, records: 1, pairs: 1 });
  h.history.record = () => { throw Error('synthetic'); };
  assert.equal(await h.wrapped.read(), snapshot); assert.equal(h.wrapped.meta?.deltas, undefined);
});
test('cache errors are misses and set errors do not prevent history recording', async () => {
  const h = setup(); h.cache.get = () => { throw Error('synthetic'); };
  h.cache.set = () => { throw Error('synthetic'); };
  assert.equal(await h.wrapped.read(), snapshot); assert.equal(h.counts().records, 1);
});
test('history write/read failures preserve source and hit results', async () => {
  const h = setup(); h.history.record = () => { throw Error('synthetic'); };
  assert.equal(await h.wrapped.read(), snapshot); assert.equal(h.wrapped.meta?.deltas, undefined);
  assert.equal(h.counts().pairs, 0); h.hit(snapshot);
  h.history.latestTwo = () => { throw Error('synthetic'); };
  assert.equal(await h.wrapped.read(), snapshot); assert.equal(Object.keys(h.wrapped.meta?.deltas ?? {}).length, 0);
});
test('provider failures clear metadata and never persist failures', async () => {
  const h = setup(); await h.wrapped.read(); const before = h.counts();
  const failure = new SourceError('timeout'); h.source.read = async () => { throw failure; };
  await assert.rejects(h.wrapped.read(), error => error === failure);
  assert.equal(h.wrapped.meta, undefined); assert.deepEqual([h.counts().sets, h.counts().records], [before.sets, before.records]);
});
test('signal is forwarded; cancellation never writes', async () => {
  const h = setup(); const controller = new AbortController();
  h.source.read = async signal => { assert.equal(signal, controller.signal); controller.abort(); return snapshot; };
  await assert.rejects(h.wrapped.read(controller.signal), { code: 'cancelled' });
  assert.equal(h.counts().sets, 0); assert.equal(h.counts().records, 0);
  h.hit(snapshot); await assert.rejects(h.wrapped.read(controller.signal), { code: 'cancelled' });
});
test('provider mismatch never persists and invalid key provider is rejected', async () => {
  const h = setup(); h.source.read = async () => createSnapshot('codex', observedAt, []);
  await assert.rejects(h.wrapped.read(), { code: 'parse' }); assert.equal(h.counts().sets, 0);
  assert.throws(() => new CachedSource(h.source, { cache: h.cache, key: { ...key, provider: 'codex' } }));
});
test('history is optional and cache reads receive the injected clock and key', async () => {
  const h = setup(); const now = Date.parse(observedAt) + 59_999;
  h.cache.get = (received, time) => { assert.deepEqual(received, key); assert.equal(time, now); return snapshot; };
  const wrapped = new CachedSource(h.source, { cache: h.cache, key, clock: () => now });
  assert.equal(await wrapped.read(), snapshot);
  assert.deepEqual(wrapped.meta?.cache, { hit: true, ageMs: 59_999 });
  assert.equal(wrapped.meta?.deltas, undefined);
});
test('a hit whose newest recorded sample is older than the shown snapshot gets n/a, not a stale delta', async () => {
  const h = setup(); h.hit(snapshot); const old = { ...key, window: { id: '5h', unit: '%', percent: 5 } };
  h.history.latestTwo = () => [{ ...old, observedAt: '2025-12-31T23:59:00.000Z' }, { ...old, observedAt: '2025-12-31T23:58:00Z' }];
  await h.wrapped.read();
  assert.deepEqual(h.wrapped.meta?.deltas?.['5h'], { status: 'n/a', reason: 'no-previous' });
});
test('a cached row from the future is a miss and age is never negative', async () => {
  const h = setup(); h.hit(createSnapshot('claude', '2026-01-01T00:00:02.000Z', [])); // now = observedAt + 1000
  assert.equal(await h.wrapped.read(), snapshot);
  assert.deepEqual(h.counts(), { reads: 1, gets: 1, sets: 1, records: 1, pairs: 1 });
  assert.deepEqual(h.wrapped.meta?.cache, { hit: false, ageMs: 1000 });
});
test('unsafe or empty cache identity is rejected at construction without echoing the value', () => {
  const h = setup();
  for (const bad of [{ scope: 'Bearer secret-token' }, { scope: 'a/b' }, { scope: '' }, { contractVersion: 'bad version' },
    { lookup: '' }, { lookup: 'x'.repeat(129) }]) assert.throws(() => new CachedSource(h.source, { cache: h.cache, key: { ...key, ...bad } }),
    (error: Error) => error instanceof RangeError && !error.message.includes('secret'));
});
