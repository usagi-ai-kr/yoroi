import assert from 'node:assert/strict';
import test from 'node:test';
import { computeInsightRankChanges, type InsightRankSnapshot } from '../src/insights/rank-change.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';

const base: InsightRecord = { source: 'arena', modelId: 'A', metric: 'rating', value: 10, unit: 'score',
  category: 'Text', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-10',
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic', method: 'synthetic', schemaVersion: 'v1' };
const entry = (modelId: string, value: number, date: string, extra: Partial<InsightRecord> = {}): ValidatedInsightRecord => {
  const result = validateInsightRecord({ ...base, modelId, value, sourceAsOf: date, ...extra });
  assert.ok(result.ok); return result.value;
};
const snapshot = (values: readonly (readonly [string, number])[], date: string, complete = true): InsightRankSnapshot =>
  ({ records: values.map(([id, value]) => entry(id, value, date)), complete });
const prior = snapshot([['A', 20], ['B', 10], ['C', 10]], '2026-10-09');
const current = snapshot([['A', 10], ['B', 30], ['C', 30]], '2026-10-10');

test('competition ties are 1,1,3 with deterministic ids and signed upward movement', () => {
  const result = computeInsightRankChanges(current, prior, 'descending');
  assert.ok(result.comparable);
  assert.deepEqual(result.changes.map(r => [r.modelId, r.currentRank, r.previousRank, r.rankChange]),
    [['A', 3, 1, -2], ['B', 1, 2, 1], ['C', 1, 2, 1]]);
  assert.ok(result.changes.every(r => r.status === 'ranked'));
  assert.deepEqual(computeInsightRankChanges({ ...current, records: [...current.records].reverse() }, prior, 'descending'), result);
  const ascending = computeInsightRankChanges(current, prior, 'ascending');
  assert.ok(ascending.comparable && ascending.changes[0]?.currentRank === 1);
});

test('complete snapshots distinguish entries and exits without numeric change', () => {
  const result = computeInsightRankChanges(snapshot([['A', 20], ['D', 5]], '2026-10-10'), prior, 'descending');
  assert.ok(result.comparable);
  assert.deepEqual(result.changes.map(r => [r.modelId, r.status, r.rankChange]),
    [['A', 'ranked', 0], ['B', 'exited', null], ['C', 'exited', null], ['D', 'entered', null]]);
});

test('incomplete cohorts expose missing evidence instead of false movement, entries or exits', () => {
  const now = snapshot([['A', 20], ['D', 5]], '2026-10-10', false);
  const result = computeInsightRankChanges(now, { ...prior, complete: false }, 'descending');
  assert.ok(result.comparable);
  assert.deepEqual(result.changes.map(r => [r.modelId, r.status, r.missingFrom]),
    [['A', 'missing', 'cohort'], ['B', 'missing', 'current'], ['C', 'missing', 'current'], ['D', 'missing', 'previous']]);
  assert.ok(result.changes.every(r => r.rankChange === null && r.currentRank === null && r.previousRank === null));
});

test('other and aggregate rows never alter ranks; empty cohorts cannot prove mass entry or exit', () => {
  const extra = [entry('other', 999, '2026-10-10'), entry('total', 999, '2026-10-10', { metadata: { aggregate: true } })];
  assert.deepEqual(computeInsightRankChanges({ ...current, records: [...extra, ...current.records] }, prior, 'descending'),
    computeInsightRankChanges(current, prior, 'descending'));
  assert.equal(computeInsightRankChanges({ complete: true, records: extra }, prior, 'descending').comparable, false);
  assert.deepEqual(computeInsightRankChanges(current, undefined, 'descending'),
    { comparable: false, reason: 'n/a: 이전 기록 없음' });
});

test('C1 group/date/schema/unit checks apply even when cohorts have no common model', () => {
  for (const change of [{ source: 'openrouter' as const, sourceAsOf: base.observedAt, metadata: { date: '2026-10-09' } },
    { metric: 'rank' }, { category: 'Code' }, { unit: 'tokens' }, { schemaVersion: 'v2' }, { method: 'other' }]) {
    assert.deepEqual(computeInsightRankChanges(current,
      { complete: true, records: [entry('X', 1, '2026-10-09', change)] }, 'descending'),
    { comparable: false, reason: 'n/a: 비교 조건 불일치' });
  }
  for (const date of ['2026-10-08', '2026-10-11']) assert.equal(
    computeInsightRankChanges(current, snapshot([['X', 1]], date), 'descending').comparable, false);
  assert.deepEqual(computeInsightRankChanges(current, current, 'descending'),
    { comparable: false, reason: 'n/a: 새 데이터 아님' });
  assert.equal(computeInsightRankChanges({ ...current, records: [current.records[0]!, entry('X', 5, '2026-10-10', { unit: 'tokens' })] },
    prior, 'descending').comparable, false);
  assert.deepEqual(computeInsightRankChanges({ ...current, records: [current.records[0]!, current.records[0]!] }, prior, 'descending'),
    { comparable: false, reason: 'n/a: 중복 모델' });
});

test('3-A unknown/fallback dates stay n/a; inputs are not mutated', () => {
  const before = JSON.stringify({ current, prior });
  for (const source of ['artificial-analysis', 'cognition'] as const) assert.deepEqual(computeInsightRankChanges(
    { complete: true, records: [entry('A', 10, base.observedAt, { source })] }, prior, 'descending'),
    { comparable: false, reason: 'n/a: 기준일 미상' });
  const anchor = current.records[0]!;
  const fallback = { ...anchor, record: { ...anchor.record, metadata: { sourceAsOfBasis: 'observedAt-fallback' } } };
  assert.deepEqual(computeInsightRankChanges({ ...current, records: [fallback] }, prior, 'descending'),
    { comparable: false, reason: 'n/a: 기준일 미상' });
  computeInsightRankChanges(current, prior, 'descending');
  assert.equal(JSON.stringify({ current, prior }), before);
});

test('S1 cached validated snapshots feed rank comparison directly', () => {
  const store = new MemoryInsightHistory();
  const key = { source: 'arena' as const, schemaVersion: 'v1', requestScope: 'text:public', publicationDate: '2026-10-09' };
  store.saveDaily(key, { ok: true, source: 'arena', records: prior.records, rejectedRows: 0 });
  const restored = store.getDaily(key)!;
  assert.deepEqual(computeInsightRankChanges(current, { records: restored.records, complete: true }, 'descending'),
    computeInsightRankChanges(current, prior, 'descending'));
});
