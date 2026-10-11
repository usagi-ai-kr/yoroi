import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { detectKeys, readState, writeState } from '../src/app/detect-state-port.js';
import { evaluateUsage, type UsageDetectState } from '../src/app/detect-usage.js';
import { INITIAL_PROBE_STATE, type ProbeBudgetState } from '../src/app/probe-budget.js';
import type { UsageWindow } from '../src/domain/usage.js';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { openDetectStateStore } from '../src/infra/sqlite/detect-state-store.js';

const T = 1_000_000, TTL = 600_000;
const tmp = (t: TestContext) => { const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-store-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const child = (dir: string, code: string, extra: Record<string, string> = {}) => new Promise<string>(resolve => {
  const proc = spawn(process.execPath, ['--import', 'tsx', '-e', code], { env: { ...process.env, YOROI_DATA_DIR: dir, ...extra } });
  let out = ''; proc.stdout.on('data', c => { out += c; }); proc.stderr.on('data', c => { out += c; });
  proc.on('close', () => resolve(out.trim()));
});

test('cursor and probe budget state survive reopening; KV validation, delete and corrupt JSON behave like the port contract', t => {
  const dir = tmp(t), env = { YOROI_DATA_DIR: dir };
  const a = openDetectStateStore(env);
  const probe: ProbeBudgetState = { ...INITIAL_PROBE_STATE, lastAttemptAtMs: T, cooldownUntilMs: T + 900_000, consecutiveFailures: 2 };
  writeState(a, detectKeys.zen('cursor'), { id: 41 }); writeState(a, detectKeys.probe('claude', 'scope-1'), probe);
  a.set(detectKeys.zen('retry-passed'), '{not json'); a.set('k', 'v'); a.delete('k'); a.close();
  const b = openDetectStateStore(env); t.after(() => b.close());
  assert.deepEqual(readState(b, detectKeys.zen('cursor'), (v): v is { id: number } => isObject(v) && typeof v.id === 'number'), { id: 41 });
  assert.deepEqual(readState(b, detectKeys.probe('claude', 'scope-1'), (v): v is ProbeBudgetState => isObject(v) && typeof v.consecutiveFailures === 'number'), probe);
  assert.equal(readState(b, detectKeys.zen('retry-passed'), (v): v is object => isObject(v)), undefined);
  assert.equal(b.get('k'), undefined);
  for (const bad of ['', 'has space', 'x'.repeat(201)]) assert.throws(() => b.set(bad, 'v'), RangeError);
  assert.throws(() => b.set('k', 'x'.repeat(4097)), RangeError);
});
test('lease across two connections: one live holder, renew, expiry takeover, fenced old owner, release', t => {
  const env = { YOROI_DATA_DIR: tmp(t) }, a = openDetectStateStore(env), b = openDetectStateStore(env);
  t.after(() => { a.close(); b.close(); });
  assert.ok(a.acquireLease('detector-a', T, TTL).acquired);
  const denied = b.acquireLease('detector-b', T + 300_000, TTL);
  assert.ok(!denied.acquired && denied.heldBy.owner === 'detector-a');
  assert.equal(a.renewLease('detector-a', T + 300_000, TTL), true);
  assert.equal(b.getLease()?.expiresAtMs, T + 300_000 + TTL);
  assert.ok(!b.acquireLease('detector-b', T + 900_000 - 1, TTL).acquired);
  const took = b.acquireLease('detector-b', T + 900_000, TTL);
  assert.ok(took.acquired && took.takeover?.owner === 'detector-a' && took.takeover.renewedAtMs === T + 300_000);
  assert.equal(a.renewLease('detector-a', T + 950_000, TTL), false);
  a.releaseLease('detector-a'); assert.equal(a.getLease()?.owner, 'detector-b');
  const again = b.acquireLease('detector-b', T + 960_000, TTL);
  assert.ok(again.acquired && again.takeover === undefined && again.lease.acquiredAtMs === T + 900_000);
  b.releaseLease('detector-b'); assert.equal(a.getLease(), undefined);
  assert.throws(() => a.acquireLease('bad owner', T, TTL), RangeError); assert.throws(() => a.acquireLease('a', T, 0), RangeError);
});
test('two processes racing for the lease: exactly one acquires, every round', async t => {
  const dir = tmp(t); openDetectStateStore({ YOROI_DATA_DIR: dir }).close();
  const code = `const { openDetectStateStore } = await import('./src/infra/sqlite/detect-state-store.ts');
    const store = openDetectStateStore(process.env); while (Date.now() < Number(process.env.START_AT)) {}
    console.log(JSON.stringify({ acquired: store.acquireLease(process.env.OWNER, ${T}, ${TTL}).acquired })); store.close();`;
  for (let round = 0; round < 3; round++) {
    const startAt = String(Date.now() + 1000);
    const out = await Promise.all(['racer-a', 'racer-b'].map(owner => child(dir, code, { OWNER: owner, START_AT: startAt })));
    assert.deepEqual(out.map(o => JSON.parse(o.split('\n').pop()!).acquired).sort(), [false, true], out.join('|'));
    const raw = openDatabase(join(dir, 'yoroi.db')); raw.exec('DELETE FROM detect_lease'); raw.close();
  }
});
test('detect, Zen and usage first opens on one fresh database converge to all tables and versions 1-4', async t => {
  const dir = tmp(t);
  const open = (mod: string, fn: string) => `const m = await import('./src/infra/sqlite/${mod}.ts'); ${fn}`;
  const codes = [open('detect-state-store', 'm.openDetectStateStore(process.env).close();'), open('zen-lock-store', 'm.openZenLockStore(process.env).close();'),
    `const m = await import('./src/infra/sqlite/usage-cache-store.ts'); const d = await import('./src/infra/sqlite/data-dir.ts'); m.openUsageDatabase(d.resolveDbPath(process.env)).close();`];
  for (let round = 0; round < 3; round++) {
    const d = join(dir, `r${round}`);
    const outs = await Promise.all(codes.map(c => child(d, c)));
    assert.deepEqual(outs, ['', '', ''], outs.join('|'));
    const db = openDatabase(join(d, 'yoroi.db'));
    try {
      const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(r => r.name);
      for (const need of ['detect_state', 'detect_lease', 'plugin_loads', 'cache_entries', 'observation_samples', 'provider_locks']) assert.ok(names.includes(need), `${need} in ${names}`);
      assert.deepEqual((db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]).map(r => r.version), [1, 2, 3, 4]);
    } finally { db.close(); }
  }
});
test('schema holds only keys, values and lease times; secret-bearing inputs never reach the database file', t => {
  const dir = tmp(t), env = { YOROI_DATA_DIR: dir }, secret = 'synthetic-secret-token';
  const store = openDetectStateStore(env);
  const window = { id: '5h', unit: 'percent', percent: 100, apiKey: secret } as UsageWindow;
  const { state } = evaluateUsage({ latest: { provider: 'claude', observedAt: '2026-10-11T00:00:00Z', window, ...{ token: secret } }, now: T,
    thresholds: { surgePercentPoints: 20, staleAfterMs: 1e12 } });
  writeState(store, detectKeys.usage('claude', '5h', 'percent'), state as UsageDetectState); store.acquireLease('detector-a', T, TTL); store.close();
  const raw = openDatabase(join(dir, 'yoroi.db'));
  try {
    const cols = (table: string) => (raw.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(r => r.name);
    assert.deepEqual(cols('detect_state'), ['key', 'value']);
    assert.deepEqual(cols('detect_lease'), ['id', 'owner', 'acquired_at_ms', 'renewed_at_ms', 'expires_at_ms']);
  } finally { raw.close(); }
  for (const file of readdirSync(dir)) assert.ok(!readFileSync(join(dir, file)).includes(secret), file);
});
