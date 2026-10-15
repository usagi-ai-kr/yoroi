import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { SqliteInsightHistory } from '../src/infra/sqlite/insights-store.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { migrate, INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/migrations.js';
import type { ValidatedInsightRecord } from '../src/insights/validation.js';

const KEY = { source: 'artificial-analysis' as const, publicationDate: '2026-10-15', requestScope: 'all', schemaVersion: '1.0' };
const SERIES_KEY = { ...KEY, modelId: 'test-model-0', metric: 'artificial_analysis_intelligence_index', unit: 'score', category: 'evaluations' };

function makeValidation(rows = 1, rejectedRows = 0, reasons?: Record<string, number>, fields?: Record<string, number>) {
  const records: ValidatedInsightRecord[] = Array.from({ length: rows }, (_, i) => ({
    comparisonDate: '2026-10-15',
    record: {
      source: 'artificial-analysis', modelId: `test-model-${i}`, metric: 'artificial_analysis_intelligence_index',
      value: 90, unit: 'score', category: 'evaluations', observedAt: '2026-10-15T00:00:00.000Z',
      sourceAsOf: '2026-10-15', sourceUrl: 'https://example.invalid', sourceName: 'AA',
      license: 'test', attributionText: 'AA', method: 'test', schemaVersion: '1.0',
    },
  }));
  return {
    ok: true as const, source: 'artificial-analysis' as const, records, rejectedRows,
    ...(reasons !== undefined && { rejectedReasons: reasons }),
    ...(fields !== undefined && { rejectedFields: fields }),
    warnings: [] as string[],
  };
}

function setupSqlite() {
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS);
  return { db, store: new SqliteInsightHistory(db) };
}

test('partial AA result persists diagnostics in SQLite and memory; history skipped, complete=false', () => {
  const { db, store: sql } = setupSqlite(); const mem = new MemoryInsightHistory();
  const partial = makeValidation(1, 1, { 'missing-id': 2 }, { id: 2 });
  assert.equal(sql.saveDaily(KEY, partial, { complete: false }), true);
  assert.equal(mem.saveDaily(KEY, partial, { complete: false }), true);

  // Diagnostics preserved in both stores
  const sqlDaily = sql.getDaily(KEY, { includePartial: true })!;
  const memDaily = mem.getDaily(KEY)!;
  assert.deepEqual(sqlDaily.rejectionDiagnostics, { reasons: { 'missing-id': 2 }, fields: { id: 2 } });
  assert.deepEqual(memDaily.rejectionDiagnostics, { reasons: { 'missing-id': 2 }, fields: { id: 2 } });

  // Partial complete is 0/false; not visible without includePartial
  assert.equal(sql.getDaily(KEY), undefined);
  const row = db.prepare('SELECT complete FROM insight_daily').get() as { complete: number };
  assert.equal(row.complete, 0);

  // Series history not recorded for partial
  const histCount = db.prepare('SELECT count(*) as c FROM insight_history').get() as { c: number };
  assert.equal(histCount.c, 0);
  assert.equal(mem.previous(SERIES_KEY, '2026-10-16'), undefined);
  db.close();
});

test('unrejected result omits rejectionDiagnostics and records complete=true', () => {
  const { db, store: sql } = setupSqlite(); const mem = new MemoryInsightHistory();
  const success = makeValidation(1, 0);
  sql.saveDaily(KEY, success); mem.saveDaily(KEY, success);
  assert.equal('rejectionDiagnostics' in sql.getDaily(KEY)!, false);
  assert.equal('rejectionDiagnostics' in mem.getDaily(KEY)!, false);
  const row = db.prepare('SELECT complete FROM insight_daily').get() as { complete: number };
  assert.equal(row.complete, 1);
  db.close();
});

test('rejected row synthetic sentinel never appears in saved payload', () => {
  const { db, store: sql } = setupSqlite();
  const SENTINEL = 'SECRET_SYNTHETIC_SENTINEL_XYZ';
  const withSentinel = makeValidation(1, 1, { 'missing-id': 1, [SENTINEL]: 1 }, { id: 1, [SENTINEL]: 1 });
  sql.saveDaily(KEY, withSentinel, { complete: false });
  const row = db.prepare('SELECT payload FROM insight_daily').get() as { payload: string };
  assert.ok(!row.payload.includes(SENTINEL));
  db.close();
});

test('empty or invalid counts omit rejectionDiagnostics key entirely', () => {
  const { db, store: sql } = setupSqlite();
  const invalidCounts = makeValidation(1, 1, { 'missing-id': 0, 'bad-date': -1 }, { id: 0 });
  sql.saveDaily(KEY, invalidCounts, { complete: false });
  assert.equal(sql.getDaily(KEY, { includePartial: true })!.rejectionDiagnostics, undefined);
  db.close();
});

test('legacy payload without rejectionDiagnostics reads cleanly', () => {
  const { db, store: sql } = setupSqlite();
  const legacyPayload = JSON.stringify({ ok: true, source: 'artificial-analysis', records: [], rejectedRows: 0, warnings: [] });
  db.prepare(`INSERT INTO insight_daily (source, publication_date, request_scope, schema_version, complete, record_count, payload, saved_at)
    VALUES (?, ?, ?, ?, 1, 0, ?, ?)`).run(KEY.source, KEY.publicationDate, KEY.requestScope, KEY.schemaVersion, legacyPayload, '2026-10-15T00:00:00Z');
  const read = sql.getDaily(KEY)!;
  assert.equal(read.ok, true);
  assert.equal(read.rejectionDiagnostics, undefined);
  db.close();
});
