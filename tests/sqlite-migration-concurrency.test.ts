import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openDatabase, withMigrationRetry } from '../src/infra/sqlite/database.js';
import { openUsageDatabase, USAGE_BUSY_TIMEOUT_MS } from '../src/infra/sqlite/usage-cache-store.js';

const NEEDED = ['cache_entries', 'observation_samples', 'plugin_loads', 'detect_state', 'detect_lease'];
const sleepSync = (ms: number) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
const tables = (dir: string): string[] => {
  const db = openDatabase(join(dir, 'yoroi.db'));
  try { return (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
    .map(row => row.name); } finally { db.close(); }
};
const child = (which: 'detect' | 'zen' | 'usage' | 'hold', dir: string, marker?: string) => new Promise<{ code: number | null; out: string }>(
  resolve => {
    const open = which === 'detect'
      ? `const { openDetectStateStore } = await import('./src/infra/sqlite/detect-state-store.ts'); openDetectStateStore(process.env).close();`
      : which === 'zen'
      ? `const { openZenLockStore } = await import('./src/infra/sqlite/zen-lock-store.ts'); openZenLockStore(process.env).close();`
      : which === 'usage'
        ? `const { openUsageDatabase } = await import('./src/infra/sqlite/usage-cache-store.ts'); const { resolveDbPath } = await import('./src/infra/sqlite/data-dir.ts'); openUsageDatabase(resolveDbPath(process.env)).close();`
        : `const { DatabaseSync } = await import('node:sqlite'); const { join } = await import('node:path');
           const { mkdirSync, writeFileSync } = await import('node:fs');
           const dir = process.env.YOROI_DATA_DIR; mkdirSync(dir, { recursive: true });
           const db = new DatabaseSync(join(dir, 'yoroi.db'));
           db.exec('PRAGMA journal_mode = WAL'); db.exec('BEGIN IMMEDIATE');
           writeFileSync(process.env.YOROI_LOCK_MARKER, 'held');
           await new Promise(r => setTimeout(r, 2000)); db.exec('ROLLBACK'); db.close();`;
    const proc = spawn(process.execPath, ['--import', 'tsx', '-e', open], {
      env: { ...process.env, YOROI_DATA_DIR: dir, ...(marker ? { YOROI_LOCK_MARKER: marker } : {}) },
    });
    let out = '';
    proc.stdout.on('data', chunk => { out += chunk; });
    proc.stderr.on('data', chunk => { out += chunk; });
    proc.on('close', code => resolve({ code, out }));
  });

test('migration retries SQLite busy/locked errors within budget without changing the timeout', t => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-d1-retry-'));
  const db = openUsageDatabase(join(root, 'yoroi.db'));
  try {
    let calls = 0;
    const result = withMigrationRetry(() => {
      assert.equal((db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout, USAGE_BUSY_TIMEOUT_MS);
      if (++calls < 3) throw Object.assign(new Error('busy'), { errcode: 5 });
      return 'ready';
    });
    assert.equal(result, 'ready');
    assert.equal(calls, 3);
    for (const [errcode, code, message, attempts] of [
      [5, undefined, 'busy', 6], [261, undefined, 'busy', 6], [6, undefined, 'locked', 6], [262, undefined, 'locked', 6],
      [undefined, 'SQLITE_BUSY_SNAPSHOT', 'failure', 6], [undefined, undefined, 'database is locked', 6], [1, undefined, 'failure', 1], [undefined, undefined, 'failure', 1],
    ] as const) {
      calls = 0; const error = Object.assign(new Error(message), { errcode, code });
      assert.throws(() => withMigrationRetry(() => { calls++; throw error; }), value => value === error); assert.equal(calls, attempts);
    }
    const ticks = [0, 0, 700], clock = t.mock.method(performance, 'now', () => ticks.shift() ?? 700);
    calls = 0; const busy = Object.assign(new Error('busy'), { errcode: 5 });
    assert.throws(() => withMigrationRetry(() => { calls++; throw busy; }), value => value === busy);
    assert.equal(calls, 1, 'a slow BUSY must not consume another wait');
    clock.mock.restore();
  } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
});
test('a held writer fails usage initialization within one second and reopening recovers', async t => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-d1-hold-'));
  const marker = join(root, 'held');
  const holder = child('hold', root, marker);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (let waited = 0; waited < 5000 && !existsSync(marker); waited += 20) sleepSync(20);
  assert.ok(existsSync(marker), 'holder must take the write lock before the assertion');
  const began = performance.now();
  assert.throws(() => openUsageDatabase(join(root, 'yoroi.db')), error =>
    (error as { errcode?: number }).errcode === 5);
  assert.ok(performance.now() - began < 1000, 'usage initialization must fail within one second');
  assert.equal((await holder).code, 0);
  const db = openUsageDatabase(join(root, 'yoroi.db'));
  try {
    assert.equal((db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout, 100);
    for (const name of NEEDED.slice(0, 2)) {
      assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name));
    }
  } finally { db.close(); }
});

test('detect, Zen and usage first opens on one fresh database converge without missing tables', async t => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-d1-race-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (let round = 0; round < 20; round += 1) {
    const dir = join(root, `run-${round}`);
    const [detect, zen, usage] = await Promise.all([child('detect', dir), child('zen', dir), child('usage', dir)]);
    assert.equal(detect.code, 0, `round ${round} detect: ${detect.out}`);
    assert.equal(zen.code, 0, `round ${round} zen: ${zen.out}`);
    assert.equal(usage.code, 0, `round ${round} usage: ${usage.out}`);
    assert.deepEqual(NEEDED.filter(name => !tables(dir).includes(name)), [], `round ${round} left tables missing`);
  }
});
