import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compose } from '../src/composition-root.js';
import { createSnapshot } from '../src/domain/usage.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../src/infra/sqlite/usage-history-store.js';

function makeEnv() {
  const stdout: string[] = [], stderr: string[] = [];
  return {
    env: { stdout: (s: string) => stdout.push(s), stderr: (s: string) => stderr.push(s), isInteractive: () => false },
    stdout, stderr,
  };
}

test('trend when DB does not exist exits 0 with "이력 없음\\n"', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trend-test-nodb-'));
  try {
    const { env, stdout, stderr } = makeEnv();
    const cli = compose({ output: env, dataDir: dir });
    const code = await cli.run(['trend']);
    assert.equal(code, 0);
    assert.equal(stdout.join(''), '이력 없음\n');
    assert.equal(stderr.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trend when DB exists but has 0 samples exits 0 with "이력 없음\\n"', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trend-test-empty-'));
  try {
    const db = openUsageDatabase(join(dir, 'yoroi.db'));
    db.close();
    const { env, stdout, stderr } = makeEnv();
    const cli = compose({ output: env, dataDir: dir });
    const code = await cli.run(['trend']);
    assert.equal(code, 0);
    assert.equal(stdout.join(''), '이력 없음\n');
    assert.equal(stderr.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trend with samples outputs plain text, --pretty table, and --json jsonl', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trend-test-samples-'));
  try {
    const dbPath = join(dir, 'yoroi.db');
    const hist = new SqliteUsageHistory(openUsageDatabase(dbPath), true);
    const now = Date.now();
    const t = (offsetHours: number) => new Date(now + offsetHours * 3600 * 1000).toISOString();
    hist.record(createSnapshot('claude', t(-2), [{ id: '5h', unit: 'percent', percent: 10 }]), { scope: 's', contractVersion: '1' });
    hist.record(createSnapshot('claude', t(0), [{ id: '5h', unit: 'percent', percent: 20 }]), { scope: 's', contractVersion: '1' });
    hist.close();

    // Default plain text
    {
      const { env, stdout } = makeEnv();
      const code = await compose({ output: env, dataDir: dir }).run(['trend']);
      assert.equal(code, 0);
      assert.match(stdout.join(''), /claude 5h percent 24h: delta=\+10%p/);
    }
    // --pretty
    {
      const { env, stdout } = makeEnv();
      const code = await compose({ output: env, dataDir: dir }).run(['trend', '--pretty']);
      assert.equal(code, 0);
      const out = stdout.join('');
      assert.ok(out.includes('Provider'));
      assert.ok(out.includes('claude'));
    }
    // --json
    {
      const { env, stdout } = makeEnv();
      const code = await compose({ output: env, dataDir: dir }).run(['trend', '--json']);
      assert.equal(code, 0);
      const parsed = JSON.parse(stdout[0]!.trim());
      assert.equal(parsed.provider, 'claude');
      assert.equal(parsed.windowId, '5h');
      assert.equal(parsed.periods['24h'].delta, 10);
      assert.doesNotMatch(stdout.join(''), /account_scope|yoroi\.db|\/Users|\/home/);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('trend on DB error/corruption exits 1 with stderr message', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'trend-test-err-'));
  try {
    writeFileSync(join(dir, 'yoroi.db'), 'not a sqlite database');
    const { env, stdout, stderr } = makeEnv();
    const code = await compose({ output: env, dataDir: dir }).run(['trend']);
    assert.equal(code, 1);
    assert.equal(stdout.length, 0);
    assert.match(stderr.join(''), /trend: storage (error|busy)\n/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
