import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheSources, openUsagePersistence } from '../src/composition/cache.js';
import { createSources, defaultFactories } from '../src/composition/sources.js';
import { loadConfig } from '../src/config/load-config.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';

/** Production source chain on a simulated macOS: Keychain via fake runner, usage via fake HTTP. */
function harness(t: TestContext) {
  const home = mkdtempSync(join(tmpdir(), 'yoroi-keychain-scope-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = { HOME: home, YOROI_DATA_DIR: join(home, 'data'), YOROI_PROVIDERS: 'claude' };
  const config = loadConfig(env), persistence = openUsagePersistence(env);
  t.after(() => persistence.close());
  const state = { account: 'a', keychain: 0, http: 0, exit: 0 };
  const runner = { run: async () => { state.keychain++;
    return { exitCode: state.exit, stderr: '', stdout: JSON.stringify({ email: `${state.account}@example.test`,
      claudeAiOauth: { accessToken: `synthetic-token-${state.account}`, expiresAt: 4102444800000 } }) }; } };
  const http = { request: async (r: { headers?: Record<string, string> }) => { state.http++;
    const percent = r.headers?.Authorization?.endsWith('-a') ? 20 : 80;
    return { status: 200, headers: {}, body: JSON.stringify({ five_hour: { utilization: percent, resets_at: '2026-10-08T05:30:00+09:00' } }) }; } };
  const collect = async (refresh = false) => {
    const [source] = cacheSources(createSources(config, defaultFactories({ runner, http, platform: 'darwin' })),
      config, env, persistence, refresh, undefined, 'darwin');
    const snapshot = await source!.read();
    return { percent: snapshot.windows[0]!.percent, hit: source!.meta?.cache?.hit };
  };
  const scopes = () => { const db = openUsageDatabase(join(home, 'data', 'yoroi.db'));
    try { return db.prepare('SELECT DISTINCT account_scope AS s FROM observation_samples').all().map(r => String(r.s)); }
    finally { db.close(); } };
  return { state, collect, scopes };
}
test('Keychain A→B within TTL fetches B and isolates account history', async t => {
  const h = harness(t);
  assert.deepEqual(await h.collect(), { percent: 20, hit: false });
  h.state.account = 'b';
  assert.deepEqual(await h.collect(), { percent: 80, hit: false }, 'B must not receive cached A usage');
  assert.deepEqual([h.state.keychain, h.state.http], [2, 2], 'one credential read per collection, no cache-only lookup');
  const scopes = h.scopes();
  assert.equal(scopes.length, 2);
  assert.ok(scopes.every(scope => /^[a-f0-9]{24}\.stable-[a-f0-9]{16}$/.test(scope)));
});
test('same Keychain account hits the cache with one Keychain read and no HTTP', async t => {
  const h = harness(t);
  await h.collect();
  assert.deepEqual(await h.collect(), { percent: 20, hit: true });
  assert.deepEqual([h.state.keychain, h.state.http], [2, 1]);
  assert.equal(h.scopes().length, 1);
});
test('Keychain failure reads once, surfaces authentication and persists nothing', async t => {
  const h = harness(t);
  h.state.exit = 44;
  await assert.rejects(h.collect(), { code: 'authentication' });
  assert.deepEqual([h.state.keychain, h.state.http], [1, 0]);
  assert.deepEqual(h.scopes(), []);
});
