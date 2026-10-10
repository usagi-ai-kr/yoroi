import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { migrate } from '../src/infra/sqlite/migrations.js';

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
