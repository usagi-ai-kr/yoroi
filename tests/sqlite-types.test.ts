import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot, type UsageSnapshot } from '../src/domain/usage.js';
import type { UsageCacheKey } from '../src/app/usage-cache-port.js';
import type { UsageCacheStore, UsageHistoryStore, ZenLockStore } from '../src/infra/sqlite/types.js';
import { SqliteUsageCache } from '../src/infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../src/infra/sqlite/usage-history-store.js';
import { SqliteZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';

test('existing SQLite stores satisfy the storage contracts (compile-time)', () => {
  const cache: UsageCacheStore = {} as SqliteUsageCache;
  const history: UsageHistoryStore = {} as SqliteUsageHistory;
  const lock: ZenLockStore = {} as SqliteZenLockStore;
  assert.ok(cache && history && lock);
});

function mockCache(): UsageCacheStore {
  const rows = new Map<string, { snapshot: UsageSnapshot; at: number }>();
  const id = (k: UsageCacheKey) => JSON.stringify([k.provider, k.lookup, k.scope, k.contractVersion]);
  return {
    get(key, now) {
      const row = rows.get(id(key));
      return row && now >= row.at && now < row.at + 60_000 ? row.snapshot : undefined;
    },
    set(key, snapshot) { rows.set(id(key), { snapshot, at: Date.parse(snapshot.observedAt) }); },
    prune(now) {
      let removed = 0;
      for (const [key, row] of rows) if (now >= row.at + 60_000) { rows.delete(key); removed++; }
      return removed;
    },
    close() {},
  };
}

test('mock UsageCacheStore honors the TTL boundary and prune contract', () => {
  const store = mockCache();
  const key: UsageCacheKey = { provider: 'claude', lookup: 'windows:all', scope: 'profile', contractVersion: 'claude@1' };
  const snapshot = createSnapshot('claude', '2026-01-01T00:00:00.000Z', [{ id: '5h', unit: 'percent', percent: 20 }]);
  store.set(key, snapshot);
  const at = Date.parse(snapshot.observedAt);
  assert.equal(store.get(key, at + 59_999), snapshot);
  assert.equal(store.get(key, at + 60_000), undefined);
  assert.equal(store.prune(at + 60_000), 1);
  assert.equal(store.get(key, at), undefined);
});
