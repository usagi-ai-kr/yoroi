import assert from 'node:assert/strict';
import test from 'node:test';
import { filterCandidates, isExcludedModel, parseFamilyVersion, compareVersions, vendorLine } from '../src/insights/letter-top10-filter.js';
import { computePlanOptimal, renderPlanOptimalLines } from '../src/insights/plan-optimal.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { computeRoleTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
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
  const entries = computeRoleTop10(records).orchestrator.entries.map(e => e.modelId);
  assert.deepEqual(entries, ['claude-opus-5-5', 'gpt-6-1-sol']); // max 90의 85%=76.5 → 80 포함(제외된 grok의 100은 기준 아님)
  const empty = previousRanks([{ modelId: 'claude-fable-5-1', value: 99, metric: 'artificial_analysis_intelligence_index' }]);
  assert.deepEqual([empty.orchestrator.size, empty.worker.size], [0, 0]);
});

test('ChatGPT line keeps only GPT-6.1 Sol: 6 Sol and 5.6 Sol are pruned by the latest-only rule', () => {
  const kept = ids(filterCandidates([variant('gpt-6-1-sol', 51.8), variant('gpt-6-sol', 47.6), variant('gpt-5-6-sol', 47.0)]));
  assert.deepEqual(kept, ['gpt-6-1-sol']);
});

test('a higher generation in the same GPT vendor line drops every lower-generation grade (gpt-gen-112)', () => {
  assert.equal(vendorLine('gpt-luna'), 'gpt');
  assert.equal(vendorLine('gpt-terra'), 'gpt');
  assert.equal(vendorLine('gpt-sol'), 'gpt');
  assert.equal(vendorLine('claude-opus'), 'claude-opus');
  assert.equal(vendorLine('claude-haiku'), 'claude-haiku');
  assert.equal(vendorLine('gemini-flash'), 'gemini-flash');
  const low = ['gpt-5-6-luna', 'gpt-5-6-terra', 'gpt-5-6-sol'];
  assert.deepEqual(ids(filterCandidates([variant('gpt-6-1-sol', 90), ...low.map(id => variant(id, 80))])),
    ['gpt-6-1-sol'], '6.1이 있으면 5.6 라인의 모든 등급이 빠진다');
  assert.deepEqual(ids(filterCandidates(low.map(id => variant(id, 80)))), low, '6.x가 없으면 5.6은 유지한다');
  const claude = ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
  assert.deepEqual(ids(filterCandidates(claude.map(id => variant(id, 90)))), claude,
    '등급이 곧 라인인 claude 계열은 각자 유지한다(haiku가 opus 세대로 지워지지 않는다)');
});

test('the plan-optimal table applies the same generation rule', () => {
  const records = [
    { modelId: 'gpt-6-1-sol', value: 90, priceInput: 1, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'gpt-5-6-luna', value: 80, priceInput: 1, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' }];
  const catalog: readonly PlanCatalogEntry[] = [{ planId: 'chatgpt-plus', planName: 'ChatGPT Plus', models: [
    { modelId: 'gpt-6-1-sol', displayName: 'GPT-6.1 Sol', sourceUrl: 'https://openai.com/chatgpt/pricing/', checkedOn: '2026-10-12', verified: true },
    { modelId: 'gpt-5-6-luna', displayName: 'GPT-5.6 Luna', sourceUrl: 'https://openai.com/chatgpt/pricing/', checkedOn: '2026-10-12', verified: true }] }];
  const plan = computePlanOptimal(records, 'orchestrator', catalog)[0]!;
  assert.deepEqual(plan.entries.map(e => e.modelId), ['gpt-6-1-sol']);
});

test('plan-optimal uses the accessible generation pool across metrics', () => {
  const records = [
    { modelId: 'gpt-6-1-sol', value: 90, metric: 'artificial_analysis_intelligence_index' },
    ...['luna', 'terra', 'sol'].map(grade => ({ modelId: `gpt-5-6-${grade}`, value: 80, metric: 'artificial_analysis_coding_index' }))];
  assert.deepEqual(computePlanOptimal(records, 'worker'), []);
  assert.doesNotMatch(renderPlanOptimalLines(records).join('\n'), /GPT-5\.6/);
});

test('generation pruning keeps unrelated vendor lines and unparseable models', () => {
  const pairs = [['gemini-3-8-pro', 'gemini-3-7-flash'], ['deepseek-v4-1-flash', 'deepseek-v4-pro'],
    ['vendor-sol-5-6', 'vendor-terra-6-1'], ['opaque-model', 'opaque-model-2']];
  for (const pair of pairs) assert.deepEqual(ids(filterCandidates(pair.map(id => variant(id)))), pair);
});
