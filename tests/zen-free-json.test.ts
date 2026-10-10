import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import type { ZenLockStore } from '../src/app/zen-lock-port.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';
import { createCli } from '../src/ui/cli/bootstrap.js';
import { compose } from '../src/composition-root.js';

function setup(store: ZenLockStore = new MemoryZenLockStore()) {
  const stdout: string[] = [], stderr: string[] = [];
  const cli = createCli({ env: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) },
    sources: [], zenLockStore: store,
    subscribeSignals: () => () => {} });
  return { cli, stdout, stderr };
}

test('new SQLite DB status and first ok report normalize missing rows to unknown', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yoroi-zen-json-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = openZenLockStore({ YOROI_DATA_DIR: root });
  t.after(() => store.close());
  const { cli, stdout } = setup(store);
  assert.equal(await cli.run(['zen-free', 'status']), 0);
  assert.equal(stdout.at(-1), 'opencode-zen-free: unknown no local status');
  assert.equal(await cli.run(['zen-free', 'report', '--ok']), 0);
  assert.equal(stdout.at(-1), 'opencode-zen-free: unknown no local status');
  assert.equal(await cli.run(['zen-free', 'status']), 0);
  assert.equal(stdout.at(-1), 'opencode-zen-free: unknown no local status');
  assert.equal(await cli.run(['zen-free', 'report', '--exceeded']), 0);
  assert.equal(await cli.run(['zen-free', 'status']), 0);
  assert.match(stdout.at(-1) ?? '', /^opencode-zen-free: locked/);
});

test('composition keeps plain and JSON status read-only when the DB file is absent', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yoroi-zen-status-'));
  const dataDir = path.join(root, 'not-created');
  const previous = process.env.YOROI_DATA_DIR;
  process.env.YOROI_DATA_DIR = dataDir;
  t.after(async () => {
    if (previous === undefined) delete process.env.YOROI_DATA_DIR;
    else process.env.YOROI_DATA_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  });
  const stdout: string[] = [], stderr: string[] = [];
  const cli = compose({ output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) } });
  assert.equal(await cli.run(['zen-free', 'status']), 0);
  assert.equal(stdout.at(-1), 'opencode-zen-free: unknown no local status');
  assert.equal(await cli.run(['zen-free', 'status', '--json']), 0);
  assert.deepEqual(JSON.parse(stdout.at(-1)!), {
    state: 'unknown', model: null, retryAt: null, retryPassed: false, updatedAt: null,
  });
  assert.deepEqual(stderr, []);
  await assert.rejects(fs.stat(dataDir));
});

test('status JSON has stable safe fields for unknown, locked, and clear states', async () => {
  const { cli, stdout } = setup();
  const keys = ['state', 'model', 'retryAt', 'retryPassed', 'updatedAt'];
  assert.equal(await cli.run(['zen-free', 'status', '--json']), 0);
  assert.deepEqual(Object.keys(JSON.parse(stdout.at(-1)!) as object), keys);
  assert.deepEqual(JSON.parse(stdout.at(-1)!), {
    state: 'unknown', model: null, retryAt: null, retryPassed: false, updatedAt: null,
  });
  assert.equal(await cli.run(['zen-free', 'report', '--exceeded', '--model', 'opencode/free-model',
    '--reason', 'secret raw detail', '--retry-at', '2000-01-01T00:00:00Z']), 0);
  assert.equal(await cli.run(['zen-free', 'status', '--json']), 0);
  const locked = JSON.parse(stdout.at(-1)!);
  assert.deepEqual(Object.keys(locked), keys);
  assert.deepEqual({ state: locked.state, model: locked.model, retryAt: locked.retryAt, retryPassed: locked.retryPassed },
    { state: 'locked', model: 'opencode/free-model', retryAt: '2000-01-01T00:00:00.000Z', retryPassed: true });
  assert.ok(!stdout.at(-1)!.includes('secret raw detail'));
  assert.equal(await cli.run(['zen-free', 'report', '--ok']), 0);
  assert.equal(await cli.run(['zen-free', 'status', '--json']), 0);
  const clear = JSON.parse(stdout.at(-1)!);
  assert.deepEqual(Object.keys(clear), keys);
  assert.equal(clear.state, 'clear');
  assert.equal(clear.retryAt, null);
  assert.equal(clear.retryPassed, false);
});

test('status JSON is documented and unavailable for write actions', async () => {
  const { cli, stdout } = setup();
  assert.equal(await cli.run(['zen-free', '--help']), 0);
  assert.ok(stdout.at(-1)?.includes('--json'));
  assert.equal(await cli.run(['zen-free', 'report', '--exceeded', '--json']), 2);
});

test('status JSON storage errors keep stdout empty with a stable error and exit code', async () => {
  const stdout: string[] = [], stderr: string[] = [];
  const store: ZenLockStore = { get: () => { throw new Error('private detail'); },
    markExceeded: () => { throw new Error('unused'); }, markOk: () => { throw new Error('unused'); }, close: () => {} };
  const cli = compose({ zenLockStore: store, output: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) } });
  assert.equal(await cli.run(['zen-free', 'status', '--json']), 1);
  assert.deepEqual(stdout, []);
  assert.deepEqual(stderr, ['zen-free storage error\n']);
});
