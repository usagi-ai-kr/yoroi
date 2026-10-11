import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { DETECT_MIGRATIONS, migrate, USAGE_MIGRATIONS, ZEN_MIGRATIONS } from '../src/infra/sqlite/migrations.js';

const versions = (db: ReturnType<typeof openDatabase>) =>
  (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[])
    .map(row => row.version);

test('migrations apply sequentially and are idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-mig-'));
  try {
    const path = join(root, 'yoroi.db');
    const first = openDatabase(path);
    assert.deepEqual(versions(first), [1]);
    migrate(first);
    migrate(first, [{ version: 2, sql: 'CREATE TABLE extra (id INTEGER)' }]);
    migrate(first, [{ version: 2, sql: 'CREATE TABLE extra (id INTEGER)' }]);
    assert.deepEqual(versions(first), [1, 2]);
    first.close();
    const second = openDatabase(path);
    assert.deepEqual(versions(second), [1, 2]);
    second.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('failed migration rolls back and is not recorded', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-mig-'));
  try {
    const db = openDatabase(join(root, 'yoroi.db'));
    assert.throws(() => migrate(db, [{ version: 2, sql: 'CREATE TABLE t (id INTEGER); BAD SQL' }]));
    assert.deepEqual(versions(db), [1]);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name = 't'").get(), undefined);
    db.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('opening the database leaks no ExperimentalWarning to stderr', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-warn-'));
  try {
    const code = `import('./src/infra/sqlite/zen-lock-store.ts').then(m => m.openZenLockStore(process.env).close())`;
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', code],
      { env: { ...process.env, YOROI_DATA_DIR: root }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stderr.includes('ExperimentalWarning'), result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Zen, usage and detect migration sets converge to v1-v4 in every opening order without touching v1 data', () => {
  const lists = [ZEN_MIGRATIONS, USAGE_MIGRATIONS, DETECT_MIGRATIONS];
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const order of orders) {
    const root = mkdtempSync(join(tmpdir(), 'yoroi-mig-order-'));
    try {
      const db = openDatabase(join(root, 'yoroi.db'));
      db.prepare("INSERT INTO provider_locks (scope, state, updated_at) VALUES ('s', 'locked', 't')").run();
      for (const index of order) { migrate(db, lists[index]); migrate(db, lists[index]); }
      assert.deepEqual(versions(db), [1, 2, 3, 4], order.join());
      const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(row => row.name);
      for (const table of ['detect_state', 'detect_lease', 'plugin_loads', 'cache_entries', 'observation_samples']) assert.ok(names.includes(table), `${table} ${order.join()}`);
      assert.equal((db.prepare('SELECT COUNT(*) AS n FROM provider_locks').get() as { n: number }).n, 1);
      db.close();
    } finally { rmSync(root, { recursive: true, force: true }); }
  }
});
