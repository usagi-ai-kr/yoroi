import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import { INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/insights-migration.js';
import {
  DETECT_MIGRATIONS, USAGE_MIGRATIONS, ZEN_MIGRATIONS, migrate,
} from '../src/infra/sqlite/migrations.js';
import { openDatabase } from '../src/infra/sqlite/database.js';

const ALL = [...USAGE_MIGRATIONS, ...ZEN_MIGRATIONS, ...DETECT_MIGRATIONS, ...INSIGHTS_MIGRATIONS];
/** 임시 DB에 v1~v5를 적용해 콜백으로 건넨다. 종료 시 디렉터리와 DB를 지운다. */
function withDb(run: (db: DatabaseSync) => void) {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-insights-mig-'));
  try { const db = openDatabase(join(root, 'yoroi.db')); migrate(db, ALL); run(db); db.close(); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
const tables = (db: DatabaseSync) => (db.prepare("SELECT name FROM sqlite_master WHERE type='table'"
  + " AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map(r => r.name);
const versions = (db: DatabaseSync) => (db.prepare('SELECT version FROM schema_migrations ORDER BY version')
  .all() as { version: number }[]).map(r => r.version);
const cols = (db: DatabaseSync, table: string) =>
  (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(c => c.name);

test('v1 through v6 apply together and stay idempotent', () => {
  assert.deepEqual(INSIGHTS_MIGRATIONS.map(m => m.version), [5], 'insights owns v5 only');
  withDb(db => {
    assert.deepEqual(versions(db), [1, 2, 3, 4, 5, 6]);
    const before = tables(db); migrate(db, ALL); migrate(db, ALL);
    assert.deepEqual(versions(db), [1, 2, 3, 4, 5, 6], 'a rerun adds nothing');
    assert.deepEqual(tables(db), before, 'a rerun creates no extra table'); });
});

test('the insights tables exist alongside Zen, usage and detect', () => {
  withDb(db => { const found = tables(db);
    for (const name of ['insight_daily', 'insight_history', 'provider_locks', 'lock_events',
      'cache_entries', 'observation_samples', 'plugin_loads', 'detect_state', 'detect_lease',
      'schema_migrations']) assert.ok(found.includes(name), `${name} must exist`); });
});

test('applying insights first then the rest still converges', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-insights-order-'));
  try { const path = join(root, 'yoroi.db'); const db = openDatabase(path);
    migrate(db, [...INSIGHTS_MIGRATIONS, ...DETECT_MIGRATIONS, ...ZEN_MIGRATIONS, ...USAGE_MIGRATIONS]);
    assert.deepEqual(versions(db), [1, 2, 3, 4, 5, 6], 'order does not matter');
    db.close();
    const again = openDatabase(path); migrate(again, ALL);
    assert.deepEqual(versions(again), [1, 2, 3, 4, 5, 6], 'a reopen adds nothing'); again.close();
  } finally { rmSync(root, { recursive: true, force: true }); } });

test('the daily primary key is the S1 InsightDailyKey', () => {
  withDb(db => {
    const pk = (db.prepare('PRAGMA table_info(insight_daily)').all() as { name: string; pk: number }[])
      .filter(c => c.pk > 0).sort((a, b) => a.pk - b.pk).map(c => c.name);
    assert.deepEqual(pk, ['source', 'publication_date', 'request_scope', 'schema_version']);
    for (const needed of ['complete', 'record_count', 'payload', 'saved_at'])
      assert.ok(cols(db, 'insight_daily').includes(needed), needed); });
});

test('the history unique key matches the 4-A duplicate-load identity', () => {
  withDb(db => {
    const unique = (db.prepare('PRAGMA index_list(insight_history)').all() as { name: string; unique: number }[])
      .filter(i => i.unique).map(i => i.name);
    assert.equal(unique.length, 1);
    const key = (db.prepare(`PRAGMA index_info(${unique[0]})`).all() as { name: string }[]).map(c => c.name);
    assert.deepEqual(key, ['source', 'model_id', 'metric', 'unit', 'category',
      'schema_version', 'request_scope', 'comparison_date']);
    assert.ok(!key.includes('publication_date'), 'the grouping publication day is not the dedup key'); });
});

test('no column can hold a credential or a raw body', () => {
  withDb(db => { for (const table of ['insight_daily', 'insight_history']) {
    for (const banned of ['api_key', 'apikey', 'token', 'secret', 'password', 'authorization',
      'headers', 'raw', 'body', 'html', 'response', 'cookie']) {
      const hit = cols(db, table).filter(c => c.toLowerCase().includes(banned));
      assert.deepEqual(hit, [], `${table} must not hold ${banned}`); } } });
});

test('the measurement value may be negative and the daily completeness is constrained', () => {
  withDb(db => {
    const insertHistory = db.prepare(`INSERT INTO insight_history (source, model_id, metric, unit, category,
      schema_version, request_scope, publication_date, comparison_date, observed_at, value, source_as_of,
      source_url, source_name, attribution_text, method) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    insertHistory.run('artificial-analysis', 'm1', 'score', 'score', 'language-models', 'aa-v2-free',
      'scope', '2026-10-12', null, '2026-10-12T00:00:00.000Z', -12.5, '2026-10-12',
      'https://artificialanalysis.ai/', 'Artificial Analysis', 'Source: AA', 'official-api');
    assert.equal((db.prepare('SELECT value FROM insight_history').get() as { value: number }).value, -12.5,
      'a negative score is legal and must not be rejected by DDL');
    insertHistory.run('artificial-analysis', 'm2', 'score', 'score', 'language-models', 'aa-v2-free',
      'scope', '2026-10-12', null, '2026-10-12T00:00:00.000Z', 1, '2026-10-12',
      'https://artificialanalysis.ai/', 'Artificial Analysis', 'Source: AA', 'official-api');
    assert.equal((db.prepare('SELECT count(*) n FROM insight_history').get() as { n: number }).n, 2,
      'a null comparison date stays distinct, so 기준일 미상 행은 날짜 이력에 중복 적재되지 않는다');
    assert.throws(() => db.prepare(`INSERT INTO insight_daily (source, publication_date, request_scope,
      schema_version, complete, record_count, payload, saved_at) VALUES ('openrouter','2026-10-12','s','v',2,0,'{}','t')`)
      .run(), /CHECK|constraint/i);
  });
});
