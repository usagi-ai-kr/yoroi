import assert from 'node:assert/strict';
import test from 'node:test';
import { calcBlendedCost, groupVariants } from '../src/insights/letter-top10-group.js';
import { computeOrchestratorTop10, computePreviousRanks, type Top10RecordInput } from '../src/insights/letter-top10-rank.js';

test('blended cost requires both finite non-negative prices; one-sided or negative is undefined', () => {
  assert.equal(calcBlendedCost(1, undefined), undefined);
  assert.equal(calcBlendedCost(undefined, 2), undefined);
  assert.equal(calcBlendedCost(-1, 2), undefined);
  assert.equal(calcBlendedCost(1, 2), (3 * 1 + 2) / 4);
  assert.equal(calcBlendedCost(0, 0), 0);
});
test('a model with unknown cost is never marked pareto (star withheld)', () => {
  const [g] = groupVariants([{ modelId: 'm', baseModelId: 'm', effort: 'default', value: 90 } as never]);
  assert.equal(g!.isPareto, false);
});
test('the zone keeps only candidates at or above the threshold: 60 equal-cost candidates yield m-0 first', () => {
  const records = Array.from({ length: 60 }, (_, i) => ({ modelId: `m-${i}`, value: 100 - i, priceInput: 100, priceOutput: 100 }));
  const entries = computeOrchestratorTop10(records).entries;
  assert.equal(entries.length, 10);
  assert.equal(entries[0]!.modelId, 'm-0');
});
test('previous ranks use the same optimal-zone policy: cheap mid-index first, below-threshold excluded', () => {
  const records: Top10RecordInput[] = [
    { modelId: 'hi', value: 100, metric: 'artificial_analysis_intelligence_index', priceInput: 1000, priceOutput: 1000 },
    { modelId: 'mid', value: 95, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 1 },
    { modelId: 'cheap', value: 60, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 1 },
  ];
  const ranks = computePreviousRanks(records, 'artificial_analysis_intelligence_index', false);
  assert.deepEqual([ranks.get('mid'), ranks.get('hi'), ranks.get('cheap')], [1, 2, undefined]); // cheap 60 < 100*0.85
});
