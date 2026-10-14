import assert from 'node:assert/strict';
import test from 'node:test';
import { splitBaseAndEffort, calcCostEfficiency, groupVariants, type ModelVariant, type ModelGroup } from '../src/insights/letter-top10-group.js';
import { selectOptimalZone, computeRanks, OPTIMAL_ZONE_THRESHOLDS } from '../src/insights/letter-top10-worker.js'; import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js'; import { toRankedRecords } from '../src/insights/letter-top10-rank.js';
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
  return groupVariants([{ modelId: id, baseModelId: id, effort: 'default', value, ...(cost !== undefined && eff !== undefined && { blendedCost: cost, costEfficiency: eff }),
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
test('inside the zone the normalized composite score ranks the low-cost mid-index model first', () => {
  const groups = [group('max', 100, 100), group('mid', 90, 1), group('low', 86, 10)];
  const order = ids(selectOptimalZone(groups, 'orchestrator').map(s => s.group));
  assert.deepEqual(order, ['mid', 'max', 'low']); // 복합 score가 지수·비용을 함께 반영
});
test('composite score replaces the former free-first tier; unknown cost gets no cost credit', () => {
  const groups = [group('free', 86, 0), group('paid', 90, 0.01), group('max', 100, 100), group('unknown', 95)];
  const order = ids(selectOptimalZone(groups, 'orchestrator').map(s => s.group));
  assert.deepEqual(order, ['paid', 'max', 'free', 'unknown']);
});
test('usage contributes to the score; exact ties use index then model ID', () => {
  const tied = [group('a', 96, 12, 100), group('b', 90, 11.25, 200)]; // eff 8 = 8, OR: b > a
  assert.deepEqual(ids(selectOptimalZone(tied, 'orchestrator').map(s => s.group)), ['b', 'a']);
  const usage = [group('less', 90, 1, 100), group('more', 90, 1, 1000)];
  assert.deepEqual(ids(selectOptimalZone(usage, 'orchestrator').map(s => s.group)), ['more', 'less']);
  const exactTie = [group('z', 90, 1, 100), group('a', 90, 1, 100)];
  assert.deepEqual(ids(selectOptimalZone(exactTie, 'orchestrator').map(s => s.group)), ['a', 'z']);
  assert.deepEqual(computeRanks([10, 20, 20, 5]), [3, 1, 1, 4]);
});
test('fewer than ten candidates show all rows with below-zone fill; previous comparison works end to end', () => {
  const records = [
    { modelId: 'claude-opus-5-5', value: 96, priceInput: 1, priceOutput: 2, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'gpt-6-1-sol', value: 85, priceInput: 0.5, priceOutput: 1, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'claude-haiku-5-5', value: 95, priceInput: 2, priceOutput: 4, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'claude-opus-5-5', value: 88, priceInput: 1, priceOutput: 2, metric: 'artificial_analysis_coding_index' },
    { modelId: 'gpt-6-1-sol', value: 82, priceInput: 0.5, priceOutput: 1, metric: 'artificial_analysis_coding_index' }];
  const lists = computeRoleTop10(records, { previousCohort: [{ modelId: 'claude-opus-5-5', rank: 1, metric: 'rank' }], cognitionRecords: [['claude-opus-5-5-max', 0.6], ['gpt-6-1-sol-high', 0.5], ['claude-haiku-5-5-max', 0.4]].map(([modelId, value]) => ({ modelId: String(modelId), metric: 'cognition_correct', value: Number(value) })) });
  assert.equal(lists.orchestrator.entries.length, 3); // 후보 3개라 사용 가능한 행 모두 표시
  assert.deepEqual(lists.orchestrator.entries.map(e => e.modelId), ['claude-opus-5-5', 'claude-haiku-5-5', 'gpt-6-1-sol']); // p75 82/6/12: 성능만 반영(Opus 1·Haiku .91·GPT .5), 순서 유지
  assert.deepEqual(lists.worker.entries.map(e => e.modelId), ['claude-opus-5-5']); // p54 워커 하한: 성능 Opus 1·GPT max(AA 0, Cog .5)·Haiku 0 → Opus만 ≥.70
  assert.ok(lists.orchestrator.entries.some(e => e.isPareto));
  assert.equal(lists.orchestrator.entries.find(e => e.modelId === 'claude-opus-5-5')!.both, true);
  assert.equal(lists.orchestrator.entries.find(e => e.modelId === 'claude-haiku-5-5')!.both, false, 'worker floor removes Haiku from the worker list');
  assert.equal(lists.orchestrator.entries.find(e => e.modelId === 'claude-haiku-5-5')!.change, '진입');
  assert.equal(lists.orchestrator.entries.find(e => e.modelId === 'claude-opus-5-5')!.change, '유지'); // 종합 점수에서도 1위 유지
});
test('orchestrator weights performance 82, usage 6 and speed 12 with no value-for-money (p75)', () => {
  const metric = 'artificial_analysis_intelligence_index', speed = 'median_output_tokens_per_second';
  const records = [{ modelId: 'claude-opus-5-5', value: 96, priceInput: 2, priceOutput: 2, metric },
    { modelId: 'gpt-6-1-sol', value: 90, priceInput: 1.5, priceOutput: 1.5, metric },
    { modelId: 'claude-opus-5-5', value: 50, metric: speed }, { modelId: 'gpt-6-1-sol', value: 80, metric: speed }];
  const scores = (rs: typeof records, opts = {}) => computeRoleTop10(rs, opts).orchestrator.entries.map(e => [e.modelId, e.scoreText]);
  assert.deepEqual(scores(records), [['claude-opus-5-5', '82.0'], ['gpt-6-1-sol', '12.0']], '성능 Opus 1 / 속도 GPT 1, 가성비 없음 (p75 82/6/12)');
  const or = [{ modelId: 'claude-opus-5-5', value: 100, metric: 'total_tokens' }, { modelId: 'gpt-6-1-sol', value: 300, metric: 'total_tokens' }]; assert.deepEqual(scores(records, { openrouterRecords: or }), [['claude-opus-5-5', '82.0'], ['gpt-6-1-sol', '18.0']], 'OpenRouter 사용량도 오케 점수에 반영된다(p75, 가중 6%)');
});
test('total_tokens records get 1..N usage ranks so the token value never becomes a rank', () => {
  const or = [{ modelId: 'claude-sonnet-5-5', value: 530462835686, metric: 'total_tokens' }, { modelId: 'gpt-6-1-sol', value: 264308530787, metric: 'total_tokens' }];
  assert.deepEqual(toRankedRecords(or).map(r => r.rank), [1, 2]);
});
