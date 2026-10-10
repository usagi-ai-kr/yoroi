import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose } from '../src/composition-root.js';
import { createSnapshot } from '../src/domain/usage.js';
import type { SourceFactories } from '../src/composition/sources.js';

const factories: SourceFactories = { codex: () => ({ provider: 'codex',
  read: async () => createSnapshot('codex', '2026-10-10T00:00:00Z', []) }) };
function output() {
  const stdout: string[] = [], stderr: string[] = [];
  return { stdout, stderr, output: { stdout: (s: string) => stdout.push(s), stderr: (s: string) => stderr.push(s) } };
}

test('once shows unknown without creating a missing Zen database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-zen-once-'));
  const previous = process.env.YOROI_DATA_DIR;
  process.env.YOROI_DATA_DIR = dir;
  try {
    const out = output();
    const code = await compose({ configEnv: { YOROI_PROVIDERS: 'codex' }, factories, output: out.output })
      .run(['once']);
    assert.equal(code, 0);
    assert.ok(out.stdout.some(line => line.startsWith('opencode-zen-free: unknown')));
    assert.equal(existsSync(join(dir, 'yoroi.db')), false);
  } finally {
    if (previous === undefined) delete process.env.YOROI_DATA_DIR; else process.env.YOROI_DATA_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('injected store close errors preserve the CLI result code', async () => {
  const out = output();
  const store = { get: () => undefined, markExceeded: () => { throw new Error(); },
    markOk: () => ({ changed: false }), close: () => { throw new Error('close failed'); } };
  const code = await compose({ zenLockStore: store, output: out.output }).run(['zen-free', 'status']);
  assert.equal(code, 0);
  assert.deepEqual(out.stderr, []);
});
