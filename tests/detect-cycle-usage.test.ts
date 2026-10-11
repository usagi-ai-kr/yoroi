import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { cacheSources, openUsagePersistence } from '../src/composition/cache.js';
import { runDetectCycle, type DetectCycleDeps } from '../src/composition/detect.js';
import { createSources, defaultFactories } from '../src/composition/sources.js';
import { loadConfig } from '../src/config/load-config.js';
import { createSnapshot } from '../src/domain/usage.js';
import { SourceError } from '../src/app/usage-source.js';
import { openDatabase } from '../src/infra/sqlite/database.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000;
function harness(t: TestContext, provider = 'codex', over: Partial<DetectCycleDeps> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-usage-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataEnv = { YOROI_DATA_DIR: dir }, env = { ...dataEnv, YOROI_PROVIDERS: provider, HOME: dir };
  const sim = { now: T0, reads: 0, percent: 40, fail: undefined as SourceError | undefined };
  const factories = { codex: () => ({ provider: 'codex' as const, read: async () => { sim.reads++; if (sim.fail) throw sim.fail;
    return createSnapshot('codex', new Date(sim.now).toISOString(), [{ id: 'weekly', unit: 'percent', percent: sim.percent, resetAt: '2026-10-18T00:00:00Z' }]); } }) };
  const deps = (): DetectCycleDeps => ({ config: loadConfig(env), env, dataEnv, now: () => sim.now, owner: 'detector-a', intervalMs: 5 * MIN, platform: 'linux', factories,
    thresholds: { surgePercentPoints: 20, staleAfterMs: 45 * MIN, pluginStaleGraceMs: 10 * MIN }, ...over });
  const at = async (minutes: number) => { sim.now = T0 + minutes * MIN; return runDetectCycle(deps()); };
  return { sim, at, deps, dir, env, dataEnv };
}
const kinds = (r: { events: readonly { kind: string }[] }) => r.events.map(e => e.kind);

test('the first cycle collects once; five-minute cycles reuse the newest sample with no provider call until the interval', async t => {
  const h = harness(t);
  assert.deepEqual(kinds(await h.at(0)), []); assert.equal(h.sim.reads, 1);
  for (const m of [5, 10, 25, 29]) { assert.deepEqual(kinds(await h.at(m)), []); assert.equal(h.sim.reads, 1, `minute ${m}`); }
  assert.deepEqual(kinds(await h.at(30)), []); assert.equal(h.sim.reads, 2);
});
test('exhaustion, release and a surge are reported once, from collected samples and from reuse', async t => {
  const h = harness(t); await h.at(0); h.sim.percent = 100;
  assert.deepEqual(kinds(await h.at(30)), ['exhausted', 'surge']);
  assert.deepEqual(kinds(await h.at(35)), []); assert.deepEqual(kinds(await h.at(40)), []);
  h.sim.percent = 20; assert.deepEqual(kinds(await h.at(60)), ['recovered']);
});
test('unavailable results store a cooldown that survives restarts; a manual once sample also postpones the next call', async t => {
  const h = harness(t); await h.at(0); h.sim.fail = new SourceError('unavailable');
  const failed = await h.at(30); assert.deepEqual([failed.errors, h.sim.reads], [['usage:codex:unavailable'], 2]);
  for (const m of [35, 40, 55]) await h.at(m);
  assert.equal(h.sim.reads, 2);
  const db = openDatabase(join(h.dir, 'yoroi.db')); t.after(() => db.close());
  const row = db.prepare("SELECT value FROM detect_state WHERE key LIKE 'probe:codex:%'").get() as { value: string };
  assert.equal(JSON.parse(row.value).consecutiveFailures, 1);
  h.sim.fail = undefined; assert.deepEqual(kinds(await h.at(61)), ['resumed']); assert.equal(h.sim.reads, 3);
  const persistence = openUsagePersistence(h.dataEnv); h.sim.now = T0 + 80 * MIN;
  await cacheSources(createSources(loadConfig(h.env), h.deps().factories), loadConfig(h.env), h.env, persistence, true, () => h.sim.now, 'linux')[0]!.read(); persistence.close();
  await h.at(100); assert.equal(h.sim.reads, 4);
  await h.at(105); assert.equal(h.sim.reads, 4);
});
test('a stale sample is reported once after repeated failures, and the sample resumes after a good collection', async t => {
  const h = harness(t); await h.at(0); h.sim.fail = new SourceError('unavailable');
  const events: string[] = [];
  for (const m of [30, 50, 55, 100]) events.push(...kinds(await h.at(m)));
  assert.deepEqual(events, ['stale']);
  h.sim.fail = undefined; assert.deepEqual(kinds(await h.at(160)), ['resumed']);
});
test('Claude Keychain is read only when the provider is actually called; reuse cycles find history without it', async t => {
  let keychain = 0, http = 0; const secret = 'synthetic-secret-token';
  const runner = { run: async () => { keychain++; return { exitCode: 0, stderr: '', stdout: JSON.stringify({ email: 'user@example.test', claudeAiOauth: { accessToken: secret, expiresAt: 4102444800000 } }) }; } };
  const client = { request: async () => { http++; return { status: 200, headers: {}, body: JSON.stringify({ five_hour: { utilization: 100, resets_at: '2026-10-11T05:00:00+00:00' } }) }; } };
  const h = harness(t, 'claude', { platform: 'darwin', factories: defaultFactories({ runner, http: client, platform: 'darwin' }) });
  h.env.HOME = h.dir;
  assert.deepEqual(kinds(await h.at(0)), ['exhausted']); assert.deepEqual([keychain, http], [1, 1]);
  for (const m of [5, 10, 15]) assert.deepEqual(kinds(await h.at(m)), []);
  assert.deepEqual([keychain, http], [1, 1]);
  const db = openDatabase(join(h.dir, 'yoroi.db')); t.after(() => db.close());
  const values = (db.prepare('SELECT key, value FROM detect_state').all() as { key: string; value: string }[]).map(r => r.key + r.value).join('\n');
  assert.ok(!values.includes(secret) && !values.includes('user@example.test'));
  assert.match(values, /scope:claude:[a-f0-9]{24}[^\n]*\.(stable|cred)-[a-f0-9]{16}/);
});

test('D2: the store hooks are factories, and the cycle closes what it obtained from them', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-own-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataEnv = { YOROI_DATA_DIR: dir }, env = { ...dataEnv, YOROI_PROVIDERS: 'codex', HOME: dir };
  let now = T0, reads = 0, opened = 0, closed = 0;
  const make = () => { opened++; const p = openUsagePersistence(dataEnv);
    return { cache: p.cache, history: p.history, close: () => { closed++; p.close(); } }; };
  const factories = { codex: () => ({ provider: 'codex' as const, read: async () => { reads++;
    return createSnapshot('codex', new Date(now).toISOString(),
      [{ id: 'weekly', unit: 'percent', percent: 40, resetAt: '2026-10-18T00:00:00Z' }]); } }) };
  // A factory that returns a fresh instance per cycle is the documented contract.
  const deps = (): DetectCycleDeps => ({ config: loadConfig(env), env, dataEnv, now: () => now, owner: 'owner-a',
    intervalMs: 5 * MIN, platform: 'linux', factories, openPersistence: make,
    thresholds: { surgePercentPoints: 20, staleAfterMs: 45 * MIN, pluginStaleGraceMs: 10 * MIN } });
  assert.deepEqual((await runDetectCycle(deps())).errors, []);
  assert.equal(closed, 1, 'the cycle closes the store it opened');
  now = T0 + 31 * MIN;
  assert.deepEqual((await runDetectCycle(deps())).errors, [], 'a fresh instance per cycle keeps working');
  assert.deepEqual([opened, closed, reads], [2, 2, 2], 'every opened store was closed exactly once');
  // Passing one long-lived instance is the documented misuse: the cycle closes it, and the next cycle degrades
  // into an error code instead of throwing out of runDetectCycle.
  const shared = make(), bad = (): DetectCycleDeps => ({ ...deps(), openPersistence: () => shared });
  assert.deepEqual((await runDetectCycle(bad())).errors, [], 'the first cycle still owns and closes it');
  const after = await runDetectCycle(bad());
  assert.equal(after.errors.length, 1, 'a reused instance is contained as one error code');
  assert.match(after.errors[0]!, /^usage(:codex|:open)$/, after.errors[0]!); });
