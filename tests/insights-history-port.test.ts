import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { insightPublicationDate, shiftInsightDate, INSIGHT_HISTORY_RETENTION_DAYS,
  type InsightDailyKey, type InsightSeriesKey } from '../src/insights/history-port.js';
import { validateInsightRows, type InsightValidation } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';

const key: InsightDailyKey = { source: 'openrouter', publicationDate: '2026-10-11', requestScope: 'text:public', schemaVersion: 'v1' };
const base: InsightRecord = { source: 'openrouter', modelId: 'synthetic', metric: 'rating', value: 10,
  unit: 'score', category: 'Text', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-10', metadata: { date: '2026-10-10' },
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic', method: 'synthetic', schemaVersion: 'v1' };
const series: InsightSeriesKey = { ...key, modelId: base.modelId, metric: base.metric, unit: base.unit, category: base.category };
const success = (changes: Partial<InsightRecord> = {}): InsightValidation => {
  const record = { ...base, ...changes };
  return validateInsightRows(record.source, [{ ok: true, index: 0, records: [record], warnings: [] }]);
};

test('KST publication boundary and 90-day policy are explicit', () => {
  assert.equal(INSIGHT_HISTORY_RETENTION_DAYS, 90);
  assert.equal(insightPublicationDate('2026-10-10T14:59:59Z'), '2026-10-10');
  assert.equal(insightPublicationDate('2026-10-10T15:00:00Z'), '2026-10-11');
  assert.equal(shiftInsightDate('2024-03-01', -1), '2024-02-29');
  assert.throws(() => shiftInsightDate('2026-02-30', 1), RangeError);
});

test('daily success is reused; failure and incomplete refresh preserve it; failed sources retry', () => {
  const store = new MemoryInsightHistory();
  const failed = validateInsightRows('openrouter', []);
  assert.equal(store.saveDaily(key, failed), false);
  assert.equal(store.getDaily(key), undefined);
  assert.equal(store.saveDaily(key, success()), true);
  assert.equal(store.saveDaily(key, success({ value: 20 })), false);
  assert.equal(store.saveDaily(key, failed, { refresh: true }), false);
  assert.equal(store.saveDaily(key, success({ value: 20 }), { refresh: true, complete: false }), false);
  assert.equal(store.getDaily(key)?.records[0]?.record.value, 10);
  assert.equal(store.saveDaily(key, success({ value: 20 }), { refresh: true }), true);
  assert.equal(store.getDaily(key)?.records[0]?.record.value, 20);
  assert.equal(store.getDaily({ ...key, publicationDate: '2026-10-12' }), undefined);
  for (const changed of [{ requestScope: 'text:pro' }, { schemaVersion: 'v2' }, { source: 'cognition' as const }])
    assert.equal(store.getDaily({ ...key, ...changed }), undefined);
});

test('exact previous day and seven-day gaps never substitute the nearest historical value', () => {
  const store = new MemoryInsightHistory();
  store.saveDaily(key, success({ sourceAsOf: '2026-10-08', metadata: { date: '2026-10-08' } }));
  store.saveDaily({ ...key, publicationDate: '2026-10-12' }, success());
  assert.equal(store.previous(series, '2026-10-10'), undefined);
  assert.equal(store.previous(series, '2026-10-11')?.record.value, 10);
  const days = store.sevenDays(series, '2026-10-11');
  assert.deepEqual(days.map(day => day.date), Array.from({ length: 7 }, (_, i) => `2026-10-${String(i + 5).padStart(2, '0')}`));
  assert.equal(days.filter(day => day.measurement).length, 2);
  for (const change of [{ modelId: 'other' }, { unit: 'tokens' }, { metric: 'rank' }, { category: 'Code' }])
    assert.equal(store.previous({ ...series, ...change }, '2026-10-11'), undefined);
  store.saveDaily({ ...key, publicationDate: '2026-10-13' }, success({ value: 30 }));
  assert.equal(store.previous(series, '2026-10-11')?.record.value, 30);
  assert.equal(store.previous(series, '2026-10-09')?.record.value, 10);
});

test('unknown basis retains daily latest data without inventing dated history; invalid success is refused', () => {
  const store = new MemoryInsightHistory();
  const cognition = { ...key, source: 'cognition' as const };
  assert.equal(store.saveDaily(cognition, success({ source: 'cognition', sourceAsOf: base.observedAt })), true);
  assert.equal(store.getDaily(cognition)?.records[0]?.comparisonDate, null);
  assert.ok(store.sevenDays({ ...series, source: 'cognition' }, '2026-10-11').every(day => !day.measurement));
  assert.equal(store.saveDaily(key, success({ schemaVersion: 'v2' })), false);
  assert.equal(store.saveDaily(key, { ok: true, source: 'openrouter', records: [], rejectedRows: 0 }), false);
  assert.equal(store.saveDaily(key, success({ source: 'cognition' })), false);
});

test('retention keeps exactly 90 publication days and callers cannot mutate stored records', () => {
  const store = new MemoryInsightHistory();
  const result = success();
  store.saveDaily({ ...key, publicationDate: '2026-07-13' }, result);
  store.saveDaily({ ...key, publicationDate: '2026-07-14' }, success({ sourceAsOf: '2026-10-09', metadata: { date: '2026-10-09' } }));
  if (result.ok) (result.records[0]!.record as { value: number }).value = 999;
  assert.equal(store.getDaily({ ...key, publicationDate: '2026-07-13' })?.records[0]?.record.value, 10);
  const read = store.previous(series, '2026-10-11')!; (read.record as { value: number }).value = 999;
  assert.equal(store.previous(series, '2026-10-11')?.record.value, 10);
  assert.equal(store.prune('2026-10-11'), 1);
  assert.equal(store.previous(series, '2026-10-11'), undefined);
  assert.equal(store.previous(series, '2026-10-10')?.record.value, 10);
});

test('only normalized fields persist and forged comparison dates cannot affect history identity', () => {
  const store = new MemoryInsightHistory();
  const validated = success();
  assert.ok(validated.ok);
  const measurement = validated.records[0]!;
  const record = { ...measurement.record, rawBody: 'synthetic-private', requestScope: 'other' };
  assert.equal(store.saveDaily(key, { ...validated, records: [{ record, comparisonDate: '2020-01-01' }] }), true);
  assert.equal(store.previous(series, '2026-10-11')?.comparisonDate, '2026-10-10');
  assert.equal('rawBody' in store.getDaily(key)!.records[0]!.record, false);
  assert.throws(() => store.getDaily({ ...key, requestScope: 'token=private' }), RangeError);
});
