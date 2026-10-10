import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { migrate } from '../src/infra/sqlite/migrations.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';

const versions = (db: ReturnType<typeof openDatabase>) =>
  (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]).map(r => r.version);
const timeout = (db: ReturnType<typeof openDatabase>) =>
  (db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout;
const names = (db: ReturnType<typeof openDatabase>) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(r => r.name);

test('v2 adds cache and history tables on top of v1 without touching v1 data, idempotently', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-v2-'));
  try {
    const path = join(root, 'yoroi.db');
    const zen = openDatabase(path);
    assert.deepEqual(versions(zen), [1]);
    assert.equal(timeout(zen), 2000);
    zen.prepare("INSERT INTO provider_locks (scope, state, updated_at) VALUES ('s', 'locked', 't')").run();
    const usage = openUsageDatabase(path);
    assert.deepEqual(versions(usage), [1, 2]);
    assert.equal(timeout(usage), 100);
    assert.equal(timeout(zen), 2000);
    for (const name of ['cache_entries', 'observation_samples', 'idx_cache_expires', 'idx_obs_latest', 'idx_obs_reset',
      'provider_locks', 'lock_events']) assert.ok(names(usage).includes(name), name);
    assert.equal((usage.prepare('SELECT COUNT(*) AS n FROM provider_locks').get() as { n: number }).n, 1);
    migrate(usage, [{ version: 1, sql: 'SELECT 1' }]);
    zen.close(); usage.close();
    const again = openUsageDatabase(path);
    assert.deepEqual(versions(again), [1, 2]);
    assert.equal(names(again).filter(n => n === 'cache_entries').length, 1);
    again.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('observation_samples enforces non-negative metrics, percent <= 100 and unique samples', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-v2-'));
  try {
    const db = openUsageDatabase(join(root, 'yoroi.db'));
    const insert = (percent: number, at = 't1') => db.prepare(`INSERT INTO observation_samples
      (provider, account_scope, contract_version, window_id, unit, observed_at, percent) VALUES ('claude', 's', 'c@1', 'w', 'percent', ?, ?)`).run(at, percent);
    insert(50);
    assert.throws(() => insert(101, 't2'));
    assert.throws(() => insert(-1, 't3'));
    assert.throws(() => insert(60), /UNIQUE/);
    db.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
