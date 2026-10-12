import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCandidates, isExcludedModel, parseFamilyVersion, compareVersions } from '../src/insights/letter-top10-filter.js';
import { computeUnifiedTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import { calcCostEfficiency, type ModelVariant } from '../src/insights/letter-top10-group.js';

const variant = (modelId: string, value = 90, cost = 1, orTokens?: number): ModelVariant => {
  const eff = calcCostEfficiency(value, cost);
  return { modelId, baseModelId: modelId, effort: 'default', value, ...(eff !== undefined && { blendedCost: cost, costEfficiency: eff }),
    ...(orTokens !== undefined && { openrouterTokens: orTokens }) };
};
const ids = (vs: readonly ModelVariant[]) => vs.map(v => v.modelId);

test('fable/astra/grok families are excluded from candidates (case-insensitive)', () => {
  for (const id of ['claude-fable-5-1', 'gpt-6-astra', 'grok-4-6', 'GROK-4', 'Fable-x', 'a-astra-b']) assert.equal(isExcludedModel(id), true, id);
  assert.equal(isExcludedModel('claude-opus-5-5'), false);
  const kept = ids(filterCandidates([variant('claude-opus-5-5'), variant('claude-fable-5-1'), variant('gpt-6-astra'), variant('grok-4-6')]));
  assert.deepEqual(kept, ['claude-opus-5-5']);
});

test('same family keeps only the highest version, including middle version groups (gpt-…-sol/flash)', () => {
  assert.deepEqual(parseFamilyVersion('claude-opus-5-5'), { family: 'claude-opus', version: [5, 5] });
  assert.deepEqual(parseFamilyVersion('claude-opus-5'), { family: 'claude-opus', version: [5] });
  assert.deepEqual(parseFamilyVersion('gemini-3-8-flash'), { family: 'gemini-flash', version: [3, 8] });
  assert.deepEqual(parseFamilyVersion('gpt-6-1-sol'), { family: 'gpt-sol', version: [6, 1] });
  assert.ok(compareVersions([5, 5], [5]) > 0);
  assert.equal(compareVersions([5], [5, 0]), 0);
  const kept = ids(filterCandidates([variant('claude-opus-5'), variant('claude-opus-5-5'), variant('claude-opus-5-5', 91),
    variant('gemini-3-8-flash'), variant('gemini-3-7-flash'), variant('qwen3-8'), variant('qwen3-8-flash-next')]));
  assert.ok(!kept.includes('claude-opus-5'));
  assert.equal(kept.filter(id => id === 'claude-opus-5-5').length, 2); // 동일 버전은 유지
  assert.ok(kept.includes('gemini-3-8-flash') && !kept.includes('gemini-3-7-flash')); // 같은 flash 계열은 최신 3.8만 (감사 fix-070-a)
  assert.ok(kept.includes('qwen3-8') && kept.includes('qwen3-8-flash-next'));
});

test('threshold max is computed after filtering: an excluded top model does not raise the bar', () => {
  const records = [
    { modelId: 'grok-4-6', value: 100, priceInput: 1, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'gpt-6-1-sol', value: 90, priceInput: 10, priceOutput: 10, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'claude-opus-5-5', value: 80, priceInput: 1, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' }];
  const entries = computeUnifiedTop10(records).entries.map(e => e.modelId);
  assert.deepEqual(entries, ['claude-opus-5-5', 'gpt-6-1-sol']); // max 90의 85%=76.5 → 80 포함(제외된 grok의 100은 기준 아님)
  assert.deepEqual(previousRanks([{ modelId: 'claude-fable-5-1', value: 99, metric: 'artificial_analysis_intelligence_index' }]).size, 0);
});

test('ChatGPT line keeps only GPT-6.1 Sol: 6 Sol and 5.6 Sol are pruned by the latest-only rule', () => {
  const kept = ids(filterCandidates([variant('gpt-6-1-sol', 51.8), variant('gpt-6-sol', 47.6), variant('gpt-5-6-sol', 47.0)]));
  assert.deepEqual(kept, ['gpt-6-1-sol']);
});
