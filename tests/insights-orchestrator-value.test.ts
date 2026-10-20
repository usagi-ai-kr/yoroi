import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { valueForMoney } from '../src/insights/letter-top10-score.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { UNCONSTRAINED_AVAILABILITY } from '../src/insights/letter-effort-availability.js';

/** R(1.0.2) 오케 가성비: 선형 I/(P+.01)(제곱 없음), log10 정방향, Cog 역방향, 차원 max. */
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-3, `${actual} ≈ ${expected}`);
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'v-test', planName: 'V Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];

test('valueForMoney is linear I/(P+.01): no square, guards for missing and non-positive intel', () => {
  near(valueForMoney(10, 1), 10 / 1.01); // 제곱이면 99.0이 된다
  assert.equal(valueForMoney(undefined, 1), undefined);
  assert.equal(valueForMoney(10, undefined), undefined);
  assert.equal(valueForMoney(0, 1), undefined);
  assert.equal(valueForMoney(-5, 1), undefined);
  assert.equal(valueForMoney(10, -1), undefined);
});

test('display calibration: raw preserved, scoreText is normal-rank (n=1→50, n=2→56.7/43.3)', () => {
  const one = computeRoleTop10([{ modelId: 'solo', metric: 'artificial_analysis_intelligence_index', value: 80, priceInput: 1, priceOutput: 1 }], { catalog: catalogOf(['solo']), effortAvailability: UNCONSTRAINED_AVAILABILITY}).orchestrator.entries[0]!;
  assert.deepEqual([one.rawScore?.toFixed(1), one.scoreText], ['90.0', '50.0'], 'n=1 → 표시 50, raw 유지(성능 75 + 가성비 15)');
  const two = computeRoleTop10([{ modelId: 'hi', metric: 'artificial_analysis_intelligence_index', value: 90, priceInput: 1, priceOutput: 1 }, { modelId: 'lo', metric: 'artificial_analysis_intelligence_index', value: 50, priceInput: 1, priceOutput: 1 }], { catalog: catalogOf(['hi', 'lo']), effortAvailability: UNCONSTRAINED_AVAILABILITY}).orchestrator.entries;
  const by = (id: string) => two.find((e) => e.modelId === id)!;
  assert.deepEqual([by('hi').rawScore?.toFixed(1), by('hi').scoreText, by('lo').rawScore?.toFixed(1), by('lo').scoreText], ['90.0', '56.7', '0.0', '43.3'], 'n=2 → 표시 56.7/43.3(정규 분위), raw 유지');
});

test('orchestrator value follows the representative effort variant (p58 linkage)', () => {
  const records: Top10RecordInput[] = [
    { modelId: 'm-low', metric: 'artificial_analysis_intelligence_index', value: 40, priceInput: 1, priceOutput: 1 },
    { modelId: 'm-high', metric: 'artificial_analysis_intelligence_index', value: 80, priceInput: 1, priceOutput: 1 },
    { modelId: 'n', metric: 'artificial_analysis_intelligence_index', value: 60, priceInput: 1, priceOutput: 1 }];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['m', 'n']), effortAvailability: UNCONSTRAINED_AVAILABILITY});
  const at = (id: string) => lists.orchestrator.entries.find(x => x.modelId === id)!;
  // 변형별 가성비(log10): m-low 0, n 0.585, m-high 1. m 대표는 high.
  assert.deepEqual([at('m').repEffort, at('m').rawScore?.toFixed(1)], ['high', '90.0']);
  near(at('n').scoreComponents?.cost, 0.585);
  assert.equal(at('n').rawScore?.toFixed(1), '46.3');
});

test('cognition USD/task joins by reverse max: cheaper task wins the dimension', () => {
  const intel = (modelId: string): Top10RecordInput => ({ modelId, metric: 'artificial_analysis_intelligence_index', value: 80 });
  const cost = (modelId: string, v: number): Top10RecordInput => ({ modelId, metric: 'cognition_cost', value: v });
  const lists = computeRoleTop10([intel('c-cheap'), intel('c-dear'), cost('c-cheap', 0.5), cost('c-dear', 5)],
    { catalog: catalogOf(['c-cheap', 'c-dear']), effortAvailability: UNCONSTRAINED_AVAILABILITY});
  const at = (id: string) => lists.orchestrator.entries.find(x => x.modelId === id)!;
  assert.deepEqual([at('c-cheap').scoreComponents?.dimensionSources?.price, at('c-dear').scoreComponents?.dimensionSources?.price], ['cognition', 'cognition']);
  assert.ok(Number(at('c-cheap').rawScore) > Number(at('c-dear').rawScore), '작업당 비용이 낮을수록 가성비·스코어가 높다');
});
