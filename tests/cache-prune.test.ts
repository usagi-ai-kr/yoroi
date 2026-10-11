import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose } from '../src/composition-root.js';
import type { UsagePersistence } from '../src/composition/cache.js';
import { createSnapshot } from '../src/domain/usage.js';
import { openUsageDatabase, SqliteUsageCache } from '../src/infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../src/infra/sqlite/usage-history-store.js';
import type { UsageSource } from '../src/app/usage-source.js';

const observedAt = '2026-10-07T00:00:00.000Z';
const codex: UsageSource = { provider: 'codex', read: async () => createSnapshot('codex', observedAt, []) };
const quiet = { stdout: () => {}, stderr: () => {} };
const rows = (db: ReturnType<typeof openUsageDatabase>, sql: string) =>
  Number((db.prepare(sql).get() as { n: number }).n);

test('once prunes expired cache and old history but leaves Zen lock rows intact', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-prune-'));
  const db = openUsageDatabase(join(dir, 'yoroi.db'));
  const now = Date.parse(observedAt);
  const old = new Date(now - 100 * 86_400_000).toISOString();
  db.prepare('INSERT INTO cache_entries (key, value, observed_at, expires_at) VALUES (?,?,?,?)')
    .run('stale', '{}', old, now - 1);
  db.prepare(`INSERT INTO observation_samples
    (provider, account_scope, contract_version, window_id, unit, observed_at) VALUES ('codex','s','v1','weekly','tokens',?)`).run(old);
  db.prepare('INSERT INTO provider_locks (scope, state, updated_at) VALUES (?,?,?)')
    .run('opencode-zen:free', 'clear', old);
  const persistence: UsagePersistence = {
    cache: new SqliteUsageCache(db), history: new SqliteUsageHistory(db), close: () => {} };
  const cli = compose({ output: quiet, factories: { codex: () => codex },
    configEnv: { YOROI_PROVIDERS: 'codex' }, dataDir: dir,
    openUsagePersistence: () => persistence, clock: () => now });
  assert.equal(await cli.run(['once']), 0);
  assert.equal(rows(db, "SELECT COUNT(*) AS n FROM cache_entries WHERE key = 'stale'"), 0);
  assert.equal(rows(db, 'SELECT COUNT(*) AS n FROM observation_samples'), 0);
  assert.equal(rows(db, 'SELECT COUNT(*) AS n FROM provider_locks'), 1);
  db.close(); rmSync(dir, { recursive: true, force: true });
});

test('prune failures never break the once result', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-prune-fail-'));
  const broken: UsagePersistence = {
    cache: { get: () => undefined, set: () => {}, prune: () => { throw new Error('boom'); }, close: () => {} },
    history: { record: () => {}, latestTwo: () => [], prune: () => { throw new Error('boom'); }, close: () => {} },
    close: () => {} };
  const cli = compose({ output: quiet, factories: { codex: () => codex },
    configEnv: { YOROI_PROVIDERS: 'codex' }, dataDir: dir,
    openUsagePersistence: () => broken, clock: () => Date.parse(observedAt) });
  assert.equal(await cli.run(['once']), 0);
  rmSync(dir, { recursive: true, force: true });
});
