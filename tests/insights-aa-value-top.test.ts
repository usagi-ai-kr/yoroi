import assert from 'node:assert/strict';
import test from 'node:test';
import { selectAaValueTop } from '../src/insights/aa-value-top.js';
import type { InsightRecord } from '../src/insights/record.js';

const rec = (modelId: string, metric: string, value: number): InsightRecord => ({ source: 'artificial-analysis',
  modelId, metric, value, unit: 'score', category: 'language-models', observedAt: '2026-10-12T00:00:00Z',
  sourceAsOf: '2026-10-12T00:00:00Z', sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis',
  license: null, attributionText: 'x', method: 'official-api', schemaVersion: 'aa-v2-free' });
const withPrices = (modelId: string, intel: number, coding: number, input?: number, output?: number): InsightRecord[] => [
  rec(modelId, 'artificial_analysis_intelligence_index', intel), rec(modelId, 'artificial_analysis_coding_index', coding),
  ...(input === undefined ? [] : [rec(modelId, 'price_1m_input_tokens', input)]),
  ...(output === undefined ? [] : [rec(modelId, 'price_1m_output_tokens', output)])];

test('a cheap low-index model enters through the value (efficiency) top50 union', () => {
  const expensive = Array.from({ length: 60 }, (_, i) => withPrices(`exp-${i}`, 100 - i, 100 - i, 1000, 1000)).flat();
  const cheap = withPrices('cheap', 10, 10, 1, 1);
  const selected = new Set(selectAaValueTop([...expensive, ...cheap]).map(r => r.modelId));
  assert.ok(selected.has('cheap'));
});
test('missing prices keep the model via index cohorts but never enter the efficiency cohorts', () => {
  const noPrice = withPrices('no-price', 99, 99);
  const pricedTop = [withPrices('p1', 60, 60, 1, 1), withPrices('p2', 50, 50, 1, 1)].flat();
  const selected = selectAaValueTop([...noPrice, ...pricedTop]);
  assert.ok(selected.some(r => r.modelId === 'no-price'));
});
test('explicit free (0/0) is allowed in the efficiency cohort and ties at the cutoff are kept', () => {
  const freeA = withPrices('free-a', 80, 80, 0, 0), freeB = withPrices('free-b', 80, 80, 0, 0);
  const paid = withPrices('paid', 10, 10, 1, 1);
  const selected = new Set(selectAaValueTop([...freeA, ...freeB, ...paid]).map(r => r.modelId));
  assert.ok(selected.has('free-a') && selected.has('free-b'));
});

test('with limit=1 a low-index model without prices stays out of the value cohorts (excluded, not treated as free)', () => {
  const hi = withPrices('hi', 100, 100, 10, 10);
  const cheapLow = withPrices('cheap-low', 2, 2, 0.01, 0.01);
  const noPrice = withPrices('no-price', 1, 1);
  const oneSided = withPrices('one-sided', 90, 90, 1);        // output 결측
  const negative = [rec('negative', 'artificial_analysis_intelligence_index', 95),
    rec('negative', 'artificial_analysis_coding_index', 95), rec('negative', 'price_1m_input_tokens', -1),
    rec('negative', 'price_1m_output_tokens', 1)];
  const selected = new Set(selectAaValueTop([...hi, ...cheapLow, ...noPrice, ...oneSided, ...negative], 1).map(r => r.modelId));
  assert.deepEqual([...selected].sort(), ['cheap-low', 'hi']);
});
test('with limit=1 the coding and intelligence efficiency unions select different models', () => {
  const m = withPrices('m', 100, 1, 1, 1);            // intel 지수·intel eff 상위
  const n = withPrices('n', 50, 0.5, 0.0001, 0.0001); // eff만 상위(지수컷 밖)
  const q = withPrices('q', 1, 100, 1, 1);            // coding 지수 상위
  const selected = new Set(selectAaValueTop([...m, ...n, ...q], 1).map(r => r.modelId));
  assert.deepEqual([...selected].sort(), ['m', 'n', 'q']);
});
test('a tie at the efficiency cutoff is kept and every metric of a selected model is preserved', () => {
  const base = [withPrices('i1', 100, 100, 1000, 1000), withPrices('i2', 90, 90, 1000, 1000)].flat();
  const u1 = withPrices('u1', 5, 5, 0.01, 0.01), u2 = withPrices('u2', 5, 5, 0.01, 0.01);
  const records = [...base, ...u1, ...u2];
  const out = selectAaValueTop(records, 1);
  assert.deepEqual([...new Set(out.map(r => r.modelId))].sort(), ['i1', 'u1', 'u2']);
  assert.equal(out.length, 12); // 선택 3모델 × 4개 metric 전부 보존
  for (const id of ['i1', 'u1', 'u2']) assert.equal(out.filter(r => r.modelId === id).length, 4);
});
