import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CachedSource } from '../src/app/cached-source.js';
import { collectOnce } from '../src/app/collect-once.js';
import { createSnapshot, providers } from '../src/domain/usage.js';
import { loadSqlite } from '../src/infra/sqlite/database.js';
import { openUsageDatabase, SqliteUsageCache } from '../src/infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../src/infra/sqlite/usage-history-store.js';

test('lock contention bounds collection latency to a few hundred ms and omits failed writes safely', async () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-contention-'));
  const path = join(root, 'yoroi.db');
  const now = Date.parse('2026-01-01T00:00:00Z');
  const key = (provider: typeof providers[number]) =>
    ({ provider, lookup: 'windows:all', scope: 'synthetic', contractVersion: 'v1' });
  const snapshot = (provider: typeof providers[number], time: number) =>
    createSnapshot(provider, new Date(time).toISOString(),
      [{ id: 'synthetic-window', unit: 'tokens', used: 20, limit: 100 }]);

  // Initialize DB, cache and history
  const db = openUsageDatabase(path);
  const cache = new SqliteUsageCache(db);
  const history = new SqliteUsageHistory(db);

  // Seed 4 cache hits
  for (const provider of providers.slice(0, 4)) {
    cache.set(key(provider), snapshot(provider, now));
  }

  // External writer holds BEGIN IMMEDIATE
  const holder = new (loadSqlite().DatabaseSync)(path);
  holder.exec('BEGIN IMMEDIATE');

  try {
    const sources = providers.map(provider => ({
      provider,
      async read() { return snapshot(provider, now + 100); },
    }));
    const wrapped = sources.map(source => new CachedSource(source, {
      cache, history, key: key(source.provider), clock: () => now + 100,
    }));

    const started = performance.now();
    const results = await collectOnce(wrapped);
    const elapsed = performance.now() - started;

    // Verify worst-case latency: around 2x 100ms busy_timeout, well within 600ms
    assert.ok(elapsed < 600, `expected under 600ms, took ${elapsed}ms`);
    assert.equal(results.length, 5);

    // 4 hits used cached snapshot from time `now`
    for (let i = 0; i < 4; i++) {
      const res = results[i]!;
      assert.ok('snapshot' in res);
      assert.equal(res.snapshot.observedAt, new Date(now).toISOString());
    }

    // 1 miss used fresh collection from time `now + 100` despite failed cache/history writes
    const miss = results[4]!;
    assert.ok('snapshot' in miss);
    assert.equal(miss.snapshot.observedAt, new Date(now + 100).toISOString());

    // Verify failed write did not corrupt cache
    assert.equal(cache.get(key(providers[4]!), now + 100), undefined);
  } finally {
    holder.exec('ROLLBACK');
    holder.close();
    db.close();
    rmSync(root, { recursive: true, force: true });
  }
});
