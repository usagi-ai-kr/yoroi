import assert from 'node:assert/strict';
import test from 'node:test';
import { computeInsightTrend } from '../src/insights/trend.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { shiftInsightDate, type InsightHistoryDay } from '../src/insights/history-port.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';

const base: InsightRecord = { source: 'openrouter', modelId: 'A', metric: 'rating', value: 10, unit: 'score',
  category: 'Text', observedAt: '2026-10-11T00:00:00Z', sourceAsOf: '2026-10-10', metadata: { date: '2026-10-10' },
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic', method: 'synthetic', schemaVersion: 'v1' };
const entry = (date: string, value = 10, extra: Partial<InsightRecord> = {}): ValidatedInsightRecord => {
  const checked = validateInsightRecord({ ...base, sourceAsOf: date, metadata: { date: date }, value, ...extra });
  assert.ok(checked.ok); return checked.value;
};
const current = entry('2026-10-10');
const slots = (values: readonly (number | null)[], end = '2026-10-10'): readonly InsightHistoryDay[] =>
  values.map((value, index) => { const date = shiftInsightDate(end, index - 6);
    return value === null ? { date } : { date, measurement: entry(date, value) }; });

test('complete actual seven-day series reports direction and C1 changes without mutating input', () => {
  for (const [values, direction] of [[[0, 1, 2, 3, 4, 5, 6], 'increasing'], [[6, 5, 4, 3, 2, 1, 0], 'decreasing'],
    [[1, 1, 1, 1, 1, 1, 1], 'unchanged'], [[1, 2, 1, 2, 1, 2, 1], 'mixed']] as const) {
    const input = slots(values); const copy = JSON.stringify(input);
    const result = computeInsightTrend(current, input);
    assert.ok(result.status === 'complete');
    assert.equal(result.direction, direction); assert.equal(result.missingDays, 0);
    assert.equal(result.startDate, '2026-10-04'); assert.equal(result.endDate, '2026-10-10');
    assert.equal(result.points.length, 7); assert.equal(result.initialLoad, false);
    assert.equal(JSON.stringify(input), copy);
  }
});

test('gaps remain explicit nulls and no change crosses a missing day', () => {
  const result = computeInsightTrend(current, slots([1, null, 3, 4, null, 6, 7]));
  assert.ok(result.status === 'partial');
  assert.equal(result.availableDays, 5); assert.equal(result.missingDays, 2); assert.equal(result.direction, null);
  assert.deepEqual(result.missingDates, ['2026-10-05', '2026-10-08']);
  assert.deepEqual(result.points[1], { date: '2026-10-05', value: null, change: null });
  assert.deepEqual(result.points[2]?.change, { comparable: false, reason: 'n/a: 전일 결측' });
});

test('initial loading, all missing slots and known older history are distinguished', () => {
  const input = slots([null, null, null, null, null, null, 10]);
  const initial = computeInsightTrend(current, input);
  assert.ok(initial.status === 'insufficient-history' && initial.initialLoad && initial.missingDays === 6);
  assert.deepEqual(initial.points[6]?.change, { comparable: false, reason: 'n/a: 이전 기록 없음' });
  const older = computeInsightTrend(current, input, { hasEarlierHistory: true });
  assert.ok(older.status === 'insufficient-history' && !older.initialLoad);
  assert.deepEqual(older.points[6]?.change, { comparable: false, reason: 'n/a: 전일 결측' });
  assert.equal(computeInsightTrend(current, slots(Array(7).fill(null))).status, 'insufficient-history');
});

test('7-day calendar range is strict, including leap day; duplicate, shuffled and short slots fail', () => {
  const input = slots([1, 2, 3, 4, 5, 6, 7]);
  for (const bad of [input.slice(1), [...input].reverse(), input.map(() => input[0]!)])
    assert.deepEqual(computeInsightTrend(current, bad), { status: 'unavailable', reason: 'n/a: 7일 슬롯 불일치' });
  const leap = computeInsightTrend(entry('2024-03-02'), slots([1, 2, 3, 4, 5, 6, 7], '2024-03-02'));
  assert.ok(leap.status === 'complete' && leap.points.some(point => point.date === '2024-02-29'));
});

test('C1 identities, 3-A, fallback and measurement dates cannot be bypassed', () => {
  const input = slots([1, 2, 3, 4, 5, 6, 7]);
  for (const extra of [{ schemaVersion: 'v2' }, { unit: 'tokens' }, { modelId: 'other' }, { category: 'Code' }, { metric: 'rank' }]) {
    const mixed = input.map((slot, index) => index === 2 ? { ...slot, measurement: entry(slot.date, 3, extra) } : slot);
    assert.deepEqual(computeInsightTrend(current, mixed), { status: 'unavailable', reason: 'n/a: 비교 조건 불일치' });
  }
  for (const source of ['artificial-analysis', 'cognition'] as const) assert.deepEqual(
    computeInsightTrend(entry(base.observedAt, 10, { source }), input), { status: 'unavailable', reason: 'n/a: 기준일 미상' });
  const fallback = { ...current, record: { ...current.record, metadata: { sourceAsOfBasis: 'observedAt-fallback' } } };
  assert.deepEqual(computeInsightTrend(fallback, input), { status: 'unavailable', reason: 'n/a: 기준일 미상' });
  assert.equal(computeInsightTrend(current, input.map((slot, index) => index === 0 ? { ...slot, measurement: current } : slot)).status,
    'unavailable');
});

test('S1 sevenDays slots are accepted directly and unknown-basis history stays unavailable', () => {
  const store = new MemoryInsightHistory();
  const key = { source: 'openrouter' as const, schemaVersion: 'v1', requestScope: 'text:public', publicationDate: '2026-10-11' };
  const records = slots([1, 2, 3, 4, 5, 6, 7]).map(slot => slot.measurement!);
  store.saveDaily(key, { ok: true, source: 'openrouter', records, rejectedRows: 0 });
  const series = { ...key, modelId: base.modelId, metric: base.metric, unit: base.unit, category: base.category };
  assert.equal(computeInsightTrend(current, store.sevenDays(series, current.comparisonDate!)).status, 'complete');
  const unknown = entry(base.observedAt, 10, { source: 'cognition' });
  store.saveDaily({ ...key, source: 'cognition' }, { ok: true, source: 'cognition', records: [unknown], rejectedRows: 0 });
  assert.deepEqual(computeInsightTrend(unknown, store.sevenDays({ ...series, source: 'cognition' }, '2026-10-10')),
    { status: 'unavailable', reason: 'n/a: 기준일 미상' });
});
