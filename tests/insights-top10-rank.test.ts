import assert from 'node:assert/strict';
import test from 'node:test';
import { splitBaseAndEffort, calcCostEfficiency, groupVariants, type ModelVariant, type ModelGroup } from '../src/insights/letter-top10-group.js';
import { selectOptimalZone, computeRanks, OPTIMAL_ZONE_THRESHOLDS } from '../src/insights/letter-top10-worker.js';
import { computeOrchestratorTop10, computeWorkerTop10 } from '../src/insights/letter-top10-rank.js';

test('effort grouping & representative variant selection', () => {
  const { base: b1, effort: e1 } = splitBaseAndEffort('claude-3-5-sonnet-high');
  assert.equal(b1, 'claude-3-5-sonnet');
  assert.equal(e1, 'high');
  const { base: b2, effort: e2 } = splitBaseAndEffort('gpt-4o');
  assert.equal(b2, 'gpt-4o');
  assert.equal(e2, 'default');

  const variants: ModelVariant[] = [
    { modelId: 'm-high', baseModelId: 'm', effort: 'high', value: 90, blendedCost: 3.0, costEfficiency: 30 },
    { modelId: 'm-low', baseModelId: 'm', effort: 'low', value: 80, blendedCost: 1.0, costEfficiency: 80 },
    { modelId: 'm-medium', baseModelId: 'm', effort: 'medium', value: 85, blendedCost: 2.0, costEfficiency: 42.5 },
  ];
  const groups = groupVariants(variants);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.repVariant.effort, 'low');
  assert.equal(groups[0]?.variants[0]?.effort, 'low');
  assert.equal(groups[0]?.variants[1]?.effort, 'medium');
  assert.equal(groups[0]?.variants[2]?.effort, 'high');
});

test('Pareto frontier identification', () => {
  const v1: ModelVariant = { modelId: 'cheap-smart', baseModelId: 'm1', effort: 'default', value: 90, blendedCost: 1, costEfficiency: 90 };
  const v2: ModelVariant = { modelId: 'expensive-dumb', baseModelId: 'm2', effort: 'default', value: 80, blendedCost: 5, costEfficiency: 16 };
  const v3: ModelVariant = { modelId: 'expensive-genius', baseModelId: 'm3', effort: 'default', value: 95, blendedCost: 10, costEfficiency: 9.5 };
  const groups = groupVariants([v1, v2, v3]);
  const g1 = groups.find(g => g.baseModelId === 'm1')!;
  const g2 = groups.find(g => g.baseModelId === 'm2')!;
  const g3 = groups.find(g => g.baseModelId === 'm3')!;
  assert.equal(g1.isPareto, true); // (1, 90) dominates (5, 80)
  assert.equal(g2.isPareto, false); // dominated by m1
  assert.equal(g3.isPareto, true); // highest value, not dominated
});

const group = (id: string, value: number, cost?: number, orTokens?: number): ModelGroup => {
  const eff = cost === undefined ? undefined : calcCostEfficiency(value, cost);
  return groupVariants([{ modelId: id, baseModelId: id, effort: 'default', value,
    ...(cost !== undefined && eff !== undefined && { blendedCost: cost, costEfficiency: eff }),
    ...(orTokens !== undefined && { openrouterTokens: orTokens }) }])[0]!;
};
const ids = (groups: readonly ModelGroup[]) => groups.map(g => g.baseModelId);

test('the 85%/75% threshold is inclusive exactly at the boundary and excludes below', () => {
  const groups = [group('max', 100, 100), group('at85', 85, 100), group('below85', 84.9, 100),
    group('at75', 75, 100), group('below75', 74.9, 100)];
  assert.equal(OPTIMAL_ZONE_THRESHOLDS.orchestrator, 0.85);
  assert.equal(OPTIMAL_ZONE_THRESHOLDS.worker, 0.75);
  const orch = ids(selectOptimalZone(groups, 'orchestrator').map(s => s.group));
  assert.deepEqual(orch, ['max', 'at85']);
  const work = ids(selectOptimalZone(groups, 'worker').map(s => s.group));
  assert.deepEqual(work, ['max', 'at85', 'below85', 'at75']);
});

test('inside the zone a low-cost mid-index model ranks first: cost-efficiency before index', () => {
  const groups = [group('max', 100, 100), group('mid', 90, 1), group('low', 86, 10)];
  const order = ids(selectOptimalZone(groups, 'orchestrator').map(s => s.group));
  assert.deepEqual(order, ['mid', 'low', 'max']); // eff 90 > 8.6 > 1
});

test('free beats a cheaper-efficiency paid model, and unknown cost is last', () => {
  const groups = [group('free', 86, 0), group('paid', 90, 0.01), group('max', 100, 100), group('unknown', 95)];
  const order = ids(selectOptimalZone(groups, 'orchestrator').map(s => s.group));
  assert.deepEqual(order, ['free', 'paid', 'max', 'unknown']);
});

test('equal cost-efficiency ties fall back to OpenRouter usage rank, then index', () => {
  const tied = [group('a', 96, 12, 100), group('b', 90, 11.25, 200)]; // eff 8 = 8, OR: b > a
  assert.deepEqual(ids(selectOptimalZone(tied, 'orchestrator').map(s => s.group)), ['b', 'a']);
  const noOr = [group('a2', 96, 12), group('b2', 90, 11.25)];
  assert.deepEqual(ids(selectOptimalZone(noOr, 'orchestrator').map(s => s.group)), ['a2', 'b2']);
  assert.deepEqual(computeRanks([10, 20, 20, 5]), [3, 1, 1, 4]);
});

test('fewer than ten groups in the zone are shown as-is without filling', () => {
  const groups = [group('max', 100, 10), group('near', 90, 1), group('far', 10, 1)];
  assert.equal(selectOptimalZone(groups, 'orchestrator').length, 2);
  const records = [
    { modelId: 'model-a', value: 90, priceInput: 1, priceOutput: 2, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'model-b', value: 85, priceInput: 0.5, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'model-c', value: 95, priceInput: 5, priceOutput: 10, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'model-a', value: 88, priceInput: 1, priceOutput: 2, metric: 'artificial_analysis_coding_index' },
    { modelId: 'model-b', value: 82, priceInput: 0.5, priceOutput: 1, metric: 'artificial_analysis_coding_index' },
  ];
  const prev = [{ modelId: 'model-a', rank: 1, metric: 'artificial_analysis_intelligence_index' }];
  const orch = computeOrchestratorTop10(records, { previousCohort: prev });
  assert.equal(orch.entries.length, 3); // max 95의 85%=80.75 → c,a,b(85) 통과, 채우기 없음
  assert.deepEqual(orch.entries.map(e => e.modelId), ['model-b', 'model-a', 'model-c']); // eff 136 > 72 > 15.2
  assert.equal(orch.entries[0]?.rank, 1);
  assert.ok(orch.entries.some(e => e.isPareto));
  const worker = computeWorkerTop10(records);
  assert.equal(worker.entries.length, 2); // coding max 88의 75%=66 → a,b
  assert.equal(worker.entries[0]?.modelId, 'model-b'); // eff: 82/0.625=131.2 > 88/1.25=70.4
  assert.ok(worker.entries.some(e => e.isPareto));
});
