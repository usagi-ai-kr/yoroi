import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheSources, openUsagePersistence } from '../src/composition/cache.js';
import { createSources, defaultFactories } from '../src/composition/sources.js';
import { loadConfig } from '../src/config/load-config.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';

/** Simulated macOS Keychain whose token rotates (same user), optionally exposing a user id. */
function harness(t: TestContext, withUserId: boolean) {
  const home = mkdtempSync(join(tmpdir(), 'yoroi-account-continuity-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const env = { HOME: home, YOROI_DATA_DIR: join(home, 'data'), YOROI_PROVIDERS: 'claude' };
  const config = loadConfig(env), persistence = openUsagePersistence(env);
  t.after(() => persistence.close());
  const state = { generation: 1, http: 0 };
  const runner = { run: async () => ({ exitCode: 0, stderr: '', stdout: JSON.stringify({
    ...(withUserId ? { email: 'user@example.test' } : {}),
    claudeAiOauth: { accessToken: `synthetic-token-${state.generation}`, expiresAt: 4102444800000 } }) }) };
  const http = { request: async () => { state.http++;
    return { status: 200, headers: {}, body: JSON.stringify({ five_hour: { utilization: 20, resets_at: '2026-10-08T05:30:00+09:00' } }) }; } };
  const collect = async (refresh = false) => {
    const [source] = cacheSources(createSources(config, defaultFactories({ runner, http, platform: 'darwin' })),
      config, env, persistence, refresh, undefined, 'darwin');
    await source!.read();
    return source!.meta?.cache?.hit;
  };
  const rows = () => { const db = openUsageDatabase(join(home, 'data', 'yoroi.db'));
    try { return db.prepare('SELECT account_scope AS s, count(*) AS n FROM observation_samples GROUP BY 1').all()
      .map(r => [String(r.s), Number(r.n)] as const); } finally { db.close(); } };
  const dataBytes = () => readdirSync(join(home, 'data')).map(f => readFileSync(join(home, 'data', f)).toString('latin1')).join('');
  return { state, collect, rows, dataBytes };
}
test('token refresh of the same user keeps the cache and history series', async t => {
  const h = harness(t, true);
  assert.equal(await h.collect(), false);
  h.state.generation = 2;
  assert.equal(await h.collect(), true); assert.equal(h.state.http, 1);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(await h.collect(true), false);
  const rows = h.rows();
  assert.equal(rows.length, 1); assert.equal(rows[0]![1], 2);
});
test('refresh without a user id starts a new series by design and never leaks secrets', async t => {
  const h = harness(t, false);
  await h.collect(); h.state.generation = 2;
  assert.equal(await h.collect(), false); assert.equal(h.state.http, 2);
  const rows = h.rows();
  assert.equal(rows.length, 2);
  assert.ok(rows.every(([scope]) => /^[a-f0-9]{24}\.cred-[a-f0-9]{16}$/.test(scope)));
  assert.ok(!h.dataBytes().includes('synthetic-token'));
});
test('user id and token never reach the persisted scope or database bytes', async t => {
  const h = harness(t, true);
  await h.collect();
  const bytes = h.dataBytes();
  assert.ok(!bytes.includes('synthetic-token') && !bytes.includes('user@example.test'));
  assert.ok(h.rows().every(([scope]) => /^[a-f0-9]{24}\.stable-[a-f0-9]{16}$/.test(scope)));
});
