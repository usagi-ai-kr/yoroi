import assert from 'node:assert/strict';
import test from 'node:test';
import { computeInsightTrend, type InsightTrendResult } from '../src/insights/trend.js';
import { evidenceRow } from '../src/insights/letter-sections.js';
import { validateInsightRecord } from '../src/insights/validation.js';
import { shiftInsightDate } from '../src/insights/history-port.js';
import type { InsightRecord } from '../src/insights/record.js';

const rec = (value: number, comparisonDate: string) => {
  const result = validateInsightRecord({
    source: 'arena', modelId: 'm1', metric: 'rating', value, unit: 'score', category: 'overall',
    observedAt: '2026-10-11T00:00:00Z', sourceAsOf: comparisonDate, sourceUrl: 'https://example.test',
    sourceName: 'Arena', license: 'CC-BY-4.0', attributionText: 'Synthetic', method: 'ips',
    schemaVersion: 'arena-hf-v1' } as InsightRecord);
  assert.ok(result.ok);
  return result;
};
const sevenDays = (throughDate: string, has: readonly string[]): readonly { date: string; measurement?: unknown }[] =>
  Array.from({ length: 7 }, (_, index) => {
    const date = shiftInsightDate(throughDate, index - 6);
    const checked = has.includes(date) ? rec(1500 + index, date) : undefined;
    return { date, ...(checked ? { measurement: checked.value } : {}) };
  });
/** Same mapping the renderer uses: every point becomes `date:결측` or `date:value`. */
const renderTrend = (result: InsightTrendResult): string => result.status === 'unavailable' ? result.reason
  : result.points.map(point => `${point.date}:${point.value === null ? '결측' : point.value}`).join(', ');

test('trend keeps seven ISO points for computation while the letter view collapses the missing run', () => {
  const slots = sevenDays('2026-10-08', ['2026-10-08']);
  const current = rec(1500, '2026-10-08').value;
  const result = computeInsightTrend(current, slots as never);
  if (result.status === 'unavailable') throw new Error(result.reason);
  const trendPoints = result.points;
  assert.equal(result.missingDays, 6);
  assert.equal(trendPoints.length, 7, 'trend contract keeps seven ISO points');
  assert.ok(trendPoints.every(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date)), JSON.stringify(trendPoints));
  const row = evidenceRow({ measurement: current, comparison: { comparable: false, reason: 'n/a: 이전 기록 없음' }, trend: result }, 'id');
  const viewPoints = (row.trend as unknown as { points: readonly { date: string; value: number | null }[] }).points;
  assert.equal(viewPoints.length, 2, JSON.stringify(viewPoints));
  assert.match(viewPoints[0]!.date, /^2026-10-02~2026-10-07$/);
  const rendered = renderTrend(row.trend);
  assert.ok(rendered.includes('2026-10-02~2026-10-07:결측'), rendered);
  assert.ok(rendered.length < 60, `${rendered.length}`);
});
test('non-consecutive missing days stay separate and only runs of two or more collapse', () => {
  const slots = sevenDays('2026-10-08', ['2026-10-03', '2026-10-05', '2026-10-08']);
  const result = computeInsightTrend(rec(1500, '2026-10-08').value, slots as never);
  if (result.status === 'unavailable') throw new Error(result.reason);
  assert.equal(result.missingDays, 4);
  assert.equal(result.availableDays, 3);
  assert.equal(result.points.length, 7);
  const row = evidenceRow({ measurement: rec(1500, '2026-10-08').value, comparison: { comparable: false, reason: 'n/a: 이전 기록 없음' }, trend: result }, 'id');
  const viewPoints = (row.trend as unknown as { points: readonly { date: string }[] }).points;
  assert.deepEqual(viewPoints.map(point => point.date),
    ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06~2026-10-07', '2026-10-08']);
});
