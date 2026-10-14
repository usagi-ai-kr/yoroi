import assert from 'node:assert/strict';
import test from 'node:test';
import { calcBlendedCost, groupVariants } from '../src/insights/letter-top10-group.js';
import { computeRoleTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { OffPeakRate } from '../src/insights/model-price-overrides.js';

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
test('the zone leads and fills from the remaining role candidates', () => {
  const models = ['claude-opus-5-5', 'gpt-6-1-sol', 'claude-haiku-5-5', 'gemini-3-1-pro', 'gemini-3-pro',
    'mistral-large-4', 'minimax-m3', 'kimi-k3', 'gemma4', 'space-bunny', 'qwen3-7-plus'];
  const records = models.map((m, i) => ({ modelId: m, value: 100 - i, priceInput: 1, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' }));
  const entries = computeRoleTop10(records).orchestrator.entries;
  assert.equal(entries.length, 10); // Kimi K3가 복귀해 Top10을 채운다.
  assert.ok(entries.some(e => e.modelId === 'kimi-k3'));
  assert.equal(entries[0]!.modelId, 'claude-opus-5-5');
});
test('previous ranks use the same composite-score and fill policy', () => {
  const records: Top10RecordInput[] = [
    { modelId: 'claude-opus-5-5', value: 100, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 5 },
    { modelId: 'gpt-6-1-sol', value: 95, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 1 },
    { modelId: 'claude-haiku-5-5', value: 60, metric: 'artificial_analysis_intelligence_index', priceInput: 1, priceOutput: 1 },
  ];
  const ranks = previousRanks(records).orchestrator;
  assert.deepEqual([ranks.get('gpt-6-1-sol'), ranks.get('claude-opus-5-5'), ranks.get('claude-haiku-5-5')], [1, 2, 3]);
  // GPT=(.875 index, 1 cost, 0 usage, .5 speed)=77.5; Opus=42.5. Haiku 60 < 100*.85, then fills rank 3.
});

test('kimi-k3 at its official price is excluded up front, yet Top10 stays filled with cheap models (price-cap-3m)', () => {
  const metric = 'artificial_analysis_intelligence_index';
  const cheap = ['claude-haiku-5-5', 'deepseek-v4-1-flash', 'gemma4', 'glm-5-3-flash', 'kimi-k2-7-code',
    'minimax-m3', 'mistral-large-4', 'nemotron-3-super', 'qwen3-7-plus', 'space-bunny', 'hy3', 'grok-4-6'];
  const records: Top10RecordInput[] = [
    { modelId: 'kimi-k3', value: 99, priceInput: 3, priceOutput: 15, metric }, // 혼합 $6.00 → 제외
    ...cheap.map((modelId, i) => ({ modelId, value: 95 - i, priceInput: 0.5, priceOutput: 0.5, metric }))];
  const entries = computeRoleTop10(records).orchestrator.entries;
  assert.ok(entries.every(e => e.modelId !== 'kimi-k3'), 'kimi-k3 공식 단가($3.00/$15.00, 혼합 $6)는 단가 상한으로 제외');
  assert.equal(entries.length, 10, '제외 뒤에도 부족분 보충으로 Top10은 10개를 채운다');
  assert.equal(entries.at(-1)!.rank, 10);
});

test('off-peak adjusted price dropping under $3 keeps a candidate that peak price would exclude (price-cap-3m)', () => {
  const rate: OffPeakRate = { input: 0.5, output: 2, sourceUrl: 'https://example.invalid/off-peak',
    checkedOn: '2026-10-13', provider: 'deepseek-platform' };
  const records = [{ modelId: 'deepseek-v4-1-flash', value: 90, priceInput: 8, priceOutput: 8,
    metric: 'artificial_analysis_intelligence_index' }];
  const withRate = { priceOverrides: { 'deepseek-v4-1-flash': rate }, nowUtc: '2026-10-12T00:00:00Z' };
  // 02:00 UTC = DeepSeek peak → off-peak 미적용 → 혼합 8 → 제외
  assert.equal(computeRoleTop10(records, { ...withRate, nowUtc: '2026-10-12T02:00:00Z' }).orchestrator.entries.length, 0);
  const kept = computeRoleTop10(records, withRate).orchestrator.entries; // 00:00 UTC = off-peak → 혼합 0.875
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.offPeak, true);
});
