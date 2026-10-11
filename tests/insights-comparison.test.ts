import assert from 'node:assert/strict';
import test from 'node:test';
import { compareInsightPrevious } from '../src/insights/comparison.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { validateInsightRecord, validateInsightRows, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';

const base: InsightRecord = { source: 'arena', modelId: 'synthetic', metric: 'rating', value: 100,
  unit: 'score', category: 'Text', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-10',
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic', method: 'synthetic', schemaVersion: 'v1' };
const measurement = (changes: Partial<InsightRecord> = {}): ValidatedInsightRecord => {
  const checked = validateInsightRecord({ ...base, ...changes });
  assert.ok(checked.ok); return checked.value;
};
const previous = measurement({ sourceAsOf: '2026-10-09' });

test('up, down, unchanged and negative score baselines retain signed unit and percent differences', () => {
  for (const [value, delta, percent] of [[120, 20, 20], [80, -20, -20], [100, 0, 0]] as const) {
    assert.deepEqual(compareInsightPrevious(measurement({ value }), previous), { comparable: true,
      currentDate: '2026-10-10', previousDate: '2026-10-09', absoluteChange: delta, percentChange: percent });
  }
  const negative = compareInsightPrevious(measurement({ value: -80 }), measurement({ sourceAsOf: '2026-10-09', value: -100 }));
  assert.ok(negative.comparable && negative.absoluteChange === 20 && negative.percentChange === 20);
});

test('zero denominators and overflowing arithmetic produce explicit n/a without NaN or Infinity', () => {
  for (const value of [0, 10]) {
    const result = compareInsightPrevious(measurement({ value }), measurement({ sourceAsOf: '2026-10-09', value: 0 }));
    assert.ok(result.comparable && result.absoluteChange === value && result.percentChange === null);
    assert.equal(result.percentUnavailable, 'n/a: 이전 값 0');
  }
  const overflow = compareInsightPrevious(measurement({ value: Number.MAX_VALUE }),
    measurement({ sourceAsOf: '2026-10-09', value: -Number.MAX_VALUE }));
  assert.deepEqual(overflow, { comparable: false, reason: 'n/a: 수치 범위 초과' });
  const ratio = compareInsightPrevious(measurement({ value: 1 }), measurement({ sourceAsOf: '2026-10-09', value: Number.MIN_VALUE }));
  assert.ok(ratio.comparable && ratio.percentChange === null && ratio.percentUnavailable === 'n/a: 수치 범위 초과');
});

test('missing, same, nonadjacent and future dates are not compared or filled from observations', () => {
  assert.deepEqual(compareInsightPrevious(measurement(), undefined), { comparable: false, reason: 'n/a: 이전 기록 없음' });
  assert.deepEqual(compareInsightPrevious(measurement(), undefined, { hasEarlierHistory: true }),
    { comparable: false, reason: 'n/a: 전일 결측' });
  for (const date of ['2026-10-08', '2026-10-11']) assert.deepEqual(
    compareInsightPrevious(measurement(), measurement({ sourceAsOf: date })), { comparable: false, reason: 'n/a: 전일 결측' });
  assert.deepEqual(compareInsightPrevious(measurement(), measurement()), { comparable: false, reason: 'n/a: 새 데이터 아님' });
  assert.equal(compareInsightPrevious(measurement({ sourceAsOf: '2024-03-01' }),
    measurement({ sourceAsOf: '2024-02-29' })).comparable, true);
});

test('all series identities must match; display aliases may change without changing identity', () => {
  for (const change of [{ schemaVersion: 'v2' }, { unit: 'tokens' }, { modelId: 'other' },
    { metric: 'rank' }, { category: 'Code' }, { method: 'other' },
    { source: 'openrouter' as const, sourceAsOf: base.observedAt, metadata: { date: '2026-10-09' } }]) {
    assert.deepEqual(compareInsightPrevious(measurement(), measurement({ sourceAsOf: '2026-10-09', ...change })),
      { comparable: false, reason: 'n/a: 비교 조건 불일치' });
  }
  assert.equal(compareInsightPrevious(measurement({ modelAlias: 'renamed' }), previous).comparable, true);
});

test('3-A and fallback dates always stay unknown; forged validated dates fail closed', () => {
  for (const source of ['artificial-analysis', 'cognition'] as const) {
    const current = measurement({ source, sourceAsOf: base.observedAt });
    assert.deepEqual(compareInsightPrevious(current, undefined), { comparable: false, reason: 'n/a: 기준일 미상' });
    assert.equal(compareInsightPrevious({ ...current, comparisonDate: '2026-10-10' }, previous).comparable, false);
  }
  const fallback = { ...previous, record: { ...previous.record, metadata: { sourceAsOfBasis: 'observedAt-fallback' } } };
  assert.deepEqual(compareInsightPrevious(measurement(), fallback), { comparable: false, reason: 'n/a: 기준일 미상' });
  assert.deepEqual(compareInsightPrevious({ ...measurement(), comparisonDate: '2026-10-11' }, previous),
    { comparable: false, reason: 'n/a: 유효하지 않은 자료' });
});

test('accepts S1 previous directly and leaves current/history values unchanged', () => {
  const store = new MemoryInsightHistory();
  const key = { source: 'arena' as const, schemaVersion: 'v1', requestScope: 'text:public', publicationDate: '2026-10-11' };
  store.saveDaily(key, validateInsightRows('arena', [{ ok: true, index: 0, records: [previous.record], warnings: [] }]));
  const series = { ...key, modelId: base.modelId, metric: base.metric, unit: base.unit, category: base.category };
  const current = measurement({ value: 120 });
  const before = JSON.stringify(current);
  assert.equal(compareInsightPrevious(current, store.previous(series, current.comparisonDate!)).comparable, true);
  assert.equal(JSON.stringify(current), before);
  assert.equal(store.previous(series, current.comparisonDate!)?.record.value, 100);
});
