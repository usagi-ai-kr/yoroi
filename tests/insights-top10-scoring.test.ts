import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { groupVariants, effortForModel, type ModelVariant } from '../src/insights/letter-top10-group.js';
import { buildVariants, effortCostMultiplier } from '../src/insights/letter-top10-rank.js';
import { ROLE_SCORE_WEIGHTS, selectOptimalZone } from '../src/insights/letter-top10-worker.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const metric = 'artificial_analysis_intelligence_index';
const variant = (modelId: string, value: number, effectiveCost?: number, usage?: number, speed?: number): ModelVariant => {
  const baseModelId = modelId.replace(/-(?:max|xhigh|high|medium|low|minimal)$/, '');
  return { modelId, baseModelId, effort: modelId.slice(baseModelId.length + 1) || 'default', value,
    ...(effectiveCost !== undefined && { blendedCost: effectiveCost, effectiveCost, costEfficiency: value / Math.max(effectiveCost, 0.01) }),
    ...(usage !== undefined && { openrouterTokens: usage }), ...(speed !== undefined && { outputTokensPerSecond: speed }) };
};
const select = (variants: readonly ModelVariant[], role: 'orchestrator' | 'worker') =>
  selectOptimalZone(groupVariants(variants), role);

test('AA alias overrides slug effort and ignores non-effort parenthetical tokens', () => {
  assert.equal(effortForModel('claude-sonnet-5-5', 'Claude Sonnet 5.5 (Max, Default Fallback)'), 'max');
  assert.equal(effortForModel('model-xhigh', 'Model (Reasoning, High)'), 'high');
  assert.equal(effortForModel('model', 'Model (Reasoning)'), 'default');
  assert.equal(effortCostMultiplier(2.01, 5.46), 2.01 / 5.46);
  assert.equal(effortCostMultiplier(undefined, 5.46), 1);
  assert.equal(effortCostMultiplier(2.01, undefined), 1);
});

test('cost-per-task scales effective mixed price and absent task data keeps the unit price', () => {
  const records = [
    { modelId: 'claude-sonnet-5-5', modelAlias: 'Claude Sonnet 5.5 (Max, Default Fallback)', metric, value: 56, priceInput: 1, priceOutput: 5 },
    { modelId: 'claude-sonnet-5-5-xhigh', modelAlias: 'Claude Sonnet 5.5 (Xhigh)', metric, value: 51.9, priceInput: 1, priceOutput: 5 },
    { modelId: 'claude-sonnet-5-5', modelAlias: 'Claude Sonnet 5.5 (Max)', metric: 'intelligence_index_cost_per_task', value: 5.46 },
    { modelId: 'claude-sonnet-5-5-xhigh', modelAlias: 'Claude Sonnet 5.5 (Xhigh)', metric: 'intelligence_index_cost_per_task', value: 2.01 },
  ];
  const built = buildVariants(records, metric, { priceOverrides: {} });
  assert.equal(built.find(v => v.effort === 'max')?.effectiveCost, 2);
  assert.ok(Math.abs(built.find(v => v.effort === 'xhigh')!.effectiveCost! - 2 * 2.01 / 5.46) < 1e-12);
  const missing = buildVariants([records[1]!], metric, { priceOverrides: {} })[0]!;
  assert.equal(missing.effectiveCost, missing.blendedCost);
});

test('off-peak overrides preserve the effort cost-per-task multiplier', () => {
  const records = [{ modelId: 'deepseek-v4-1-flash', metric: 'intelligence_index_cost_per_task', value: 1 },
    { modelId: 'deepseek-v4-1-flash-high', metric: 'intelligence_index_cost_per_task', value: 2 },
    { modelId: 'deepseek-v4-1-flash-high', metric, value: 60, priceInput: 0.3, priceOutput: 1.2 }];
  const rate = { input: 0.15, output: 0.6, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', provider: 'deepseek-platform' as const };
  const built = buildVariants(records, metric, { nowUtc: '2026-10-12T00:00:00Z', priceOverrides: { 'deepseek-v4-1-flash': rate } });
  assert.ok(Math.abs(built[0]!.blendedCost! - 0.2625) < 1e-12);
  assert.ok(Math.abs(built[0]!.effectiveCost! - 0.525) < 1e-12);
});

test('role weight sets sum to one; a composite score can reverse the former free-first cost tier', () => {
  for (const weights of Object.values(ROLE_SCORE_WEIGHTS)) assert.equal(Object.values(weights).reduce((a, b) => a + b, 0), 1);
  const free = variant('free', 85, 0.01, 1, 10), paid = variant('paid', 100, 10, 1000, 100);
  assert.deepEqual(select([free, paid], 'orchestrator').map(s => s.group.baseModelId), ['paid', 'free']);
});

test('normalization handles a single value and imputes missing speed with the pool median', () => {
  const single = select([variant('one', 100, 2, 50, 20)], 'worker')[0]!;
  assert.deepEqual(single.components, { index: 1, cost: 1, usage: 1, speed: 1 });
  const rows = select([variant('slow', 100, 2, 10, 10), variant('fast', 100, 2, 1000, 100), variant('missing', 100, 2)], 'worker');
  assert.equal(rows.find(s => s.group.baseModelId === 'slow')?.components.speed, 0);
  assert.equal(rows.find(s => s.group.baseModelId === 'fast')?.components.speed, 1);
  assert.ok(Math.abs(rows.find(s => s.group.baseModelId === 'missing')!.components.speed - (Math.log10(55) - 1)) < 1e-12);
  assert.equal(select([variant('unknown', 100)], 'worker')[0]!.components.speed, 0.5);
});

test('role weights can change the order; selected effort uses composite score, not cost efficiency', () => {
  const usage = variant('usage', 100, 1, 1000, 10), speed = variant('speed', 100, 1, 1, 100);
  assert.equal(select([usage, speed], 'orchestrator')[0]!.group.baseModelId, 'usage');
  assert.equal(select([usage, speed], 'worker')[0]!.group.baseModelId, 'speed');
  const variants = [variant('model-max', 100, 1, 100, 100), variant('model-low', 90, 0.8, 1, 10),
    variant('peer', 100, 1, 1, 10)];
  const picked = select(variants, 'worker');
  assert.equal(picked.find(s => s.group.baseModelId === 'model')?.group.repVariant.effort, 'max');
});

test('successors and alternate dated IDs are removed before role cutoff calculation', () => {
  const catalog: readonly PlanCatalogEntry[] = [{ planId: 'test', planName: 'Test', models: ['old', 'new', 'peer']
    .map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true })) }];
  const records = [{ modelId: 'old', metric, value: 100 }, { modelId: 'new', metric, value: 84, successorOf: 'old' },
    { modelId: 'org/peer-0424', metric, value: 80 }, { modelId: 'peer', metric, value: 80 }];
  const pool = buildCandidatePool(records, catalog);
  assert.deepEqual(pool.accessibleRecords.map(r => r.modelId), ['new', 'peer']);
  const selected = selectOptimalZone(groupVariants(buildVariants(pool.accessibleRecords, metric, { priceOverrides: {} })), 'orchestrator');
  assert.deepEqual(selected.map(s => s.group.baseModelId), ['new', 'peer'], 'peer passes the 85% cutoff after old is superseded');
});
