import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { USAGE_CACHE_TTL_MS, type UsageCacheKey } from '../src/app/usage-cache-port.js';
import { createSnapshot } from '../src/domain/usage.js';
import { loadSqlite } from '../src/infra/sqlite/database.js';
import { openUsageCache, openUsageDatabase, SqliteUsageCache } from '../src/infra/sqlite/usage-cache-store.js';

const start = Date.parse('2026-10-10T00:00:00.000Z');
const key: UsageCacheKey = { provider: 'claude', lookup: 'windows:all', scope: 'profile-a', contractVersion: 'claude@1' };
const snap = (offset = 0) => createSnapshot('claude', new Date(start + offset).toISOString(),
  [{ id: '5h', unit: 'percent', percent: 20, resetAt: '2026-10-10T05:00:00.000Z' }]);
function withRoot(run: (root: string, env: NodeJS.ProcessEnv) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-cache-'));
  try { run(root, { YOROI_DATA_DIR: root }); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('TTL boundary, preserved observedAt, key isolation and persistence across reopen', () => withRoot((_, env) => {
  const cache = openUsageCache(env);
  assert.equal(cache.get(key, start), undefined);
  cache.set(key, snap());
  for (const offset of [0, USAGE_CACHE_TTL_MS - 1]) assert.deepEqual(cache.get(key, start + offset), snap());
  for (const offset of [-1, USAGE_CACHE_TTL_MS]) assert.equal(cache.get(key, start + offset), undefined);
  assert.equal(cache.get(key, Number.NaN), undefined);
  for (const changed of [{ scope: 'profile-b' }, { contractVersion: 'claude@2' }, { lookup: 'window:5h' }, { provider: 'codex' as const }])
    assert.equal(cache.get({ ...key, ...changed }, start), undefined);
  cache.close();
  const reopened = openUsageCache(env);
  assert.equal(reopened.get(key, start + 1_000)?.observedAt, snap().observedAt);
  reopened.set(key, snap(5_000));
  assert.equal(reopened.get(key, start + 5_000)?.observedAt, snap(5_000).observedAt);
  assert.equal(reopened.prune(start + 5_000 + USAGE_CACHE_TTL_MS), 1);
  assert.equal(reopened.prune(start + 5_000 + USAGE_CACHE_TTL_MS), 0);
  reopened.close();
}));

test('keys are injectively encoded and unsafe identifiers or mismatched providers are rejected', () => withRoot((_, env) => {
  const cache = openUsageCache(env);
  cache.set({ ...key, lookup: 'a:b', scope: 'c' }, snap());
  assert.equal(cache.get({ ...key, lookup: 'a', scope: 'b:c' }, start), undefined);
  assert.ok(cache.get({ ...key, lookup: 'a:b', scope: 'c' }, start));
  for (const scope of ['', 'Bearer abc', 'a/b', 'x'.repeat(65)]) assert.throws(() => cache.get({ ...key, scope }, start), RangeError);
  assert.throws(() => cache.set({ ...key, contractVersion: 'bad version' }, snap()), RangeError);
  assert.throws(() => cache.set({ ...key, provider: 'codex' }, snap()), RangeError);
  cache.close();
}));

test('corrupt rows are misses and are deleted', () => withRoot((root, env) => {
  openUsageCache(env).close();
  const raw = openUsageDatabase(join(root, 'yoroi.db'));
  const cache = new SqliteUsageCache(raw);
  const id = JSON.stringify([key.provider, key.lookup, key.scope, key.contractVersion]);
  const put = (value: string, observedAt = snap().observedAt) => raw.prepare(`INSERT OR REPLACE INTO cache_entries
    (key, value, observed_at, expires_at) VALUES (?, ?, ?, ?)`).run(id, value, observedAt, start + USAGE_CACHE_TTL_MS);
  const count = () => (raw.prepare('SELECT COUNT(*) AS n FROM cache_entries').get() as { n: number }).n;
  const good = { provider: 'claude', observedAt: snap().observedAt, windows: snap().windows };
  for (const [value, at] of [['{not json', undefined], [JSON.stringify({ ...good, windows: [{ id: 'w', unit: 'percent', percent: 200 }] }), undefined],
    [JSON.stringify({ ...good, provider: 'codex' }), undefined], [JSON.stringify(good), 'not-a-time'],
    [JSON.stringify({ ...good, observedAt: '2026-10-10T00:00:01.000Z' }), undefined]] as const) {
    put(value, at); assert.equal(count(), 1);
    assert.equal(cache.get(key, start), undefined); assert.equal(count(), 0);
  }
  raw.close();
}));

test('SQLITE_BUSY is a miss/skip for the cache connection (100ms) while reads still work', () => withRoot((root, env) => {
  const path = join(root, 'yoroi.db');
  const cache = new SqliteUsageCache(openUsageDatabase(path));
  cache.set(key, snap());
  const holder = new (loadSqlite().DatabaseSync)(path);
  holder.exec('BEGIN IMMEDIATE');
  const began = Date.now();
  cache.set({ ...key, scope: 'profile-b' }, snap());
  assert.ok(Date.now() - began < 1_500, 'busy_timeout stays short');
  assert.equal(cache.prune(start + USAGE_CACHE_TTL_MS), 0);
  assert.ok(cache.get(key, start));
  holder.exec('ROLLBACK'); holder.close();
  assert.equal(cache.get({ ...key, scope: 'profile-b' }, start), undefined);
  cache.set({ ...key, scope: 'profile-b' }, snap());
  assert.ok(cache.get({ ...key, scope: 'profile-b' }, start));
  void env;
}));

test('only normalized window fields are stored or restored; extra properties never reach the DB', () => withRoot((root, env) => {
  const cache = openUsageCache(env);
  const dirty = createSnapshot('claude', snap().observedAt, [{ id: '5h', unit: 'percent', percent: 20, resetAt: '2026-10-10T05:00:00.000Z',
    rawResponse: { authorization: 'synthetic-review-only' }, headers: { 'x-secret': 'synthetic-review-only' } } as never]);
  cache.set(key, dirty);
  assert.deepEqual(cache.get(key, start), snap());
  cache.close();
  const raw = openUsageDatabase(join(root, 'yoroi.db'));
  const value = (raw.prepare('SELECT value FROM cache_entries').get() as { value: string }).value;
  assert.ok(!value.includes('synthetic-review-only') && !value.includes('rawResponse'));
  raw.prepare('UPDATE cache_entries SET value = ?').run(value.replace('"percent":20', '"percent":20,"leak":"synthetic-review-only"'));
  const dirtyRead = new SqliteUsageCache(raw).get(key, start);
  assert.ok(!JSON.stringify(dirtyRead).includes('synthetic-review-only'));
  raw.close(); void env;
}));
