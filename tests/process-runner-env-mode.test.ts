import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeProcessRunner } from '../src/infra/process-runner.js';

const MARK = 'YOROI_ENV_MODE_PROBE';

async function withMark(run: () => Promise<void>): Promise<void> {
  const prev = process.env[MARK];
  process.env[MARK] = 'host-value';
  try { await run(); } finally {
    if (prev === undefined) delete process.env[MARK]; else process.env[MARK] = prev;
  }
}

test('merge (default) keeps host env and lets request override', async () => {
  await withMark(async () => {
    const runner = new NodeProcessRunner();
    const merged = await runner.run({ executable: '/usr/bin/env', args: [], timeoutMs: 10000, env: { FROM_REQ: 'req-value' } });
    assert.ok(merged.stdout.includes(`${MARK}=host-value`), 'host kept by default');
    assert.ok(merged.stdout.includes('FROM_REQ=req-value'), 'request added');
    const over = await runner.run({ executable: '/usr/bin/env', args: [], timeoutMs: 10000, env: { [MARK]: 'req-wins' } });
    assert.ok(over.stdout.includes(`${MARK}=req-wins`), 'request overrides host');
  });
});

test('replace never merges host env', async () => {
  await withMark(async () => {
    const runner = new NodeProcessRunner();
    const out = await runner.run({ executable: '/usr/bin/env', args: [], timeoutMs: 10000, env: { FROM_REQ: 'req-value' }, envMode: 'replace' });
    assert.ok(!out.stdout.includes('host-value'), 'host excluded');
    assert.ok(out.stdout.includes('FROM_REQ=req-value'), 'request kept');
  });
});
