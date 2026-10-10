import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveDataDir, resolveDbPath } from '../src/infra/sqlite/data-dir.js';
import { openDatabase } from '../src/infra/sqlite/database.js';

test('data dir prefers YOROI_DATA_DIR, then XDG_DATA_HOME, then HOME', () => {
  assert.equal(resolveDataDir({ YOROI_DATA_DIR: '/x/y', XDG_DATA_HOME: '/z' }), '/x/y');
  assert.equal(resolveDataDir({ XDG_DATA_HOME: '/z' }), '/z/yoroi');
  assert.equal(resolveDataDir({ HOME: '/home/u' }), '/home/u/.local/share/yoroi');
  assert.equal(resolveDataDir({ HOME: '/home/u', XDG_DATA_HOME: 'relative' }), '/home/u/.local/share/yoroi');
  assert.equal(resolveDbPath({ YOROI_DATA_DIR: '/x/y' }), '/x/y/yoroi.db');
});

test('openDatabase creates 0700 directory and 0600 file with WAL', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-dir-'));
  try {
    const dir = join(root, 'nested', 'yoroi');
    const db = openDatabase(join(dir, 'yoroi.db'));
    const mode = (path: string) => statSync(path).mode & 0o777;
    assert.equal(mode(dir), 0o700);
    assert.equal(mode(join(dir, 'yoroi.db')), 0o600);
    assert.equal((db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode, 'wal');
    assert.equal((db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout, 2000);
    db.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
