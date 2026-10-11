import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import type { ZenLockStore } from '../src/app/zen-lock-port.js';
import { openUsagePersistence } from '../src/composition/cache.js';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';
import { createCli } from '../src/ui/cli/bootstrap.js';
import { parseZenFree } from '../src/ui/cli/zen-free-args.js';

function setup(store: ZenLockStore = new MemoryZenLockStore()) {
  const out: string[] = [], err: string[] = [];
  const cli = createCli({ env: { stdout: l => out.push(l), stderr: l => err.push(l) }, sources: [],
    zenLockStore: store, subscribeSignals: () => () => {} });
  return { cli, out, err, json: async () => { await cli.run(['zen-free', 'status', '--json']); return JSON.parse(out.at(-1)!); } };
}
const tmp = async (t: test.TestContext) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yoroi-zen-loaded-'));
  t.after(() => fs.rm(root, { recursive: true, force: true })); return root;
};
async function fakeBin(t: test.TestContext, body: string) {
  const root = await tmp(t), bin = path.join(root, 'yoroi'), previous = process.env.YOROI_BIN;
  await fs.writeFile(bin, `#!/bin/sh\n${body}\n`, { mode: 0o700 }); process.env.YOROI_BIN = bin;
  t.after(() => { if (previous === undefined) delete process.env.YOROI_BIN; else process.env.YOROI_BIN = previous; });
  return root;
}
const plugin = async () => (await import(new URL('../integrations/opencode/yoroi-zen-free.js', import.meta.url).href)).YoroiZenFreePlugin();

test('--loaded takes no report options and cannot be combined with other operations or --json', () => {
  assert.deepEqual(parseZenFree(['report', '--loaded']), { kind: 'zen-free', operation: 'loaded' });
  for (const bad of [['--loaded', '--model', 'free'], ['--loaded', '--reason', 'x'], ['--loaded', '--retry-in', '5'],
    ['--loaded', '--ok'], ['--exceeded', '--loaded'], ['--loaded', '--json']]) {
    assert.equal(parseZenFree(['report', ...bad]).kind, 'error', bad.join(' '));
  }
});
test('status says "not recorded" before any load and shows the time after report --loaded (plain and JSON)', async () => {
  const { cli, out, json } = setup();
  await cli.run(['zen-free', 'status']);
  assert.equal(out.at(-1), 'opencode-zen-free: unknown no local status\nplugin-loaded: not recorded');
  assert.equal((await json()).loadedAt, null);
  assert.equal(await cli.run(['zen-free', 'report', '--loaded']), 0);
  assert.match(out.at(-1)!, /^opencode-zen-free: unknown no local status\nplugin-loaded: \d{4}-\d\d-\d\dT[\d:.]+Z$/);
  const status = await json();
  assert.match(status.loadedAt, /^\d{4}-\d\d-\d\dT[\d:.]+Z$/); assert.equal(status.state, 'unknown'); assert.equal(status.updatedAt, null);
});
test('a load never changes lock semantics: locked stays locked and ok still clears', async () => {
  const { cli, json } = setup();
  await cli.run(['zen-free', 'report', '--exceeded', '--model', 'free']);
  const before = await json();
  await cli.run(['zen-free', 'report', '--loaded']);
  assert.deepEqual({ ...(await json()), loadedAt: null }, before);
  await cli.run(['zen-free', 'report', '--ok']);
  assert.equal((await json()).state, 'clear');
});
test('SQLite persists only a scope and time, keeps the newest load, and coexists with usage migrations', async t => {
  const root = await tmp(t); const env = { YOROI_DATA_DIR: root };
  const store = openZenLockStore(env);
  store.markLoaded!({ scope: 's', observedAt: '2026-10-11T03:00:00.000Z' });
  store.markLoaded!({ scope: 's', observedAt: '2026-10-11T02:00:00.000Z' });
  assert.equal(store.loadedAt!('s'), '2026-10-11T03:00:00.000Z'); assert.equal(store.get('s'), undefined);
  store.close();
  assert.equal(openZenLockStore(env).loadedAt!('s'), '2026-10-11T03:00:00.000Z');
  const usage = openUsagePersistence(env); usage.close();
  const db = openDatabase(path.join(root, 'yoroi.db'));
  t.after(() => db.close());
  const rows = (sql: string) => db.prepare(sql).all() as Record<string, unknown>[];
  assert.deepEqual(rows('SELECT version FROM schema_migrations ORDER BY version').map(r => r.version), [1, 2, 3]);
  assert.deepEqual(rows('PRAGMA table_info(plugin_loads)').map(r => r.name), ['scope', 'loaded_at']);
  assert.equal(rows('SELECT COUNT(*) AS n FROM provider_locks')[0]!.n, 0);
  assert.equal(rows('SELECT COUNT(*) AS n FROM lock_events')[0]!.n, 0);
});
test('unreadable or unsupported load storage degrades to "not recorded" without failing status', async () => {
  const broken: ZenLockStore = { ...new MemoryZenLockStore(), get: () => undefined, markExceeded: () => { throw Error(); },
    markOk: () => ({ changed: false }), close() {}, loadedAt: () => { throw Error('boom'); } };
  const a = setup(broken); assert.equal(await a.cli.run(['zen-free', 'status']), 0);
  assert.match(a.out.at(-1)!, /plugin-loaded: not recorded$/);
  const legacy: ZenLockStore = { get: () => undefined, markExceeded: () => { throw Error(); }, markOk: () => ({ changed: false }), close() {} };
  const b = setup(legacy); assert.equal(await b.cli.run(['zen-free', 'report', '--loaded']), 0);
  assert.match(b.out.at(-1)!, /plugin-loaded: not recorded$/);
});
test('plugin load reports --loaded through the existing report path without waiting for it', async t => {
  const root = await fakeBin(t, `echo "$@" > "${'$'}{0%/*}/args.txt"; sleep 1`);
  const started = Date.now(), hooks = await plugin();
  assert.ok(Date.now() - started < 500); assert.equal(typeof hooks.event, 'function');
  for (let i = 0; i < 50 && !(await fs.readFile(path.join(root, 'args.txt'), 'utf8').catch(() => '')); i++) await new Promise(r => setTimeout(r, 40));
  assert.equal((await fs.readFile(path.join(root, 'args.txt'), 'utf8')).trim(), 'zen-free report --loaded');
});
test('a missing or failing yoroi binary never breaks plugin loading', async t => {
  const previous = process.env.YOROI_BIN; t.after(() => { if (previous === undefined) delete process.env.YOROI_BIN; else process.env.YOROI_BIN = previous; });
  for (const bin of ['/nonexistent/yoroi', '/usr/bin/false']) {
    process.env.YOROI_BIN = bin; const hooks = await plugin();
    assert.equal(typeof hooks.event, 'function'); await hooks.event({ event: { type: 'session.idle', properties: {} } });
  }
});
