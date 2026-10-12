import assert from 'node:assert/strict';
import test from 'node:test';
import { calcBlendedCost, groupVariants } from '../src/insights/letter-top10-group.js';
import { computeUnifiedTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

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
test('the zone keeps only candidates at or above the threshold: order by cost efficiency then value', () => {
  const models = ['claude-opus-5-5', 'gpt-6-1-sol', 'claude-haiku-5-5', 'gemini-3-1-pro', 'gemini-3-pro',
    'mistral-large-4', 'minimax-m3', 'kimi-k3', 'gemma4', 'space-bunny', 'qwen3-7-plus'];
  const records = models.map((m, i) => ({ modelId: m, value: 100 - i, priceInput: 10, priceOutput: 10, metric: 'artificial_analysis_intelligence_index' }));
  const entries = computeUnifiedTop10(records).entries;
  assert.equal(entries.length, 10);
  assert.equal(entries[0]!.modelId, 'claude-opus-5-5');
});
test('previous ranks use the same optimal-zone policy: cheap mid-index first, below-threshold excluded', () => {
  const records: Top10RecordInput[] = [
    { modelId: 'claude-opus-5-5', value: 100, metric: 'artificial_analysis_intelligence_index', priceInput: 1000, priceOutput: 1000 },
    { modelId: 'gpt-6-1-sol', value: 95, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 1 },
    { modelId: 'claude-haiku-5-5', value: 60, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 1 },
  ];
  const ranks = previousRanks(records);
  assert.deepEqual([ranks.get('gpt-6-1-sol'), ranks.get('claude-opus-5-5'), ranks.get('claude-haiku-5-5')], [1, 2, undefined]); // cheap 60 < 100*0.85
});
