import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { orchestratorVariants, type Raw } from '../src/insights/letter-top10-score-raw.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** R(1.2.1): 오케 가중치 75/0/10/15(사용량 제외·선형 가성비), effort 상한 없음. */
const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'e-test', planName: 'E Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];
const aa = (modelId: string, metric: string, value: number, price?: number): Top10RecordInput =>
  ({ modelId, metric, value, ...(price !== undefined && { priceInput: price, priceOutput: price }) });
const cog = (modelId: string, value: number): Top10RecordInput => ({ modelId, metric: 'cognition_correct', value });
const cogCost = (modelId: string, value: number): Top10RecordInput => ({ modelId, metric: 'cognition_cost', value });
const raw = (aaE: readonly string[], cogE: readonly string[] = []): Raw =>
  ({ aaEffort: new Map(aaE.map(e => [e, 1])), cogEffort: new Map(cogE.map(e => [e, 0.5])) });
const orch = (records: Top10RecordInput[], ids: string[], cognitionRecords: Top10RecordInput[] = []) =>
  computeRoleTop10(records, { catalog: catalogOf(ids), cognitionRecords }).orchestrator.entries;

test('variants are the observed performance-source efforts in order; default only when it is the sole observation', () => {
  assert.deepEqual(orchestratorVariants(raw(['max', 'low'], ['medium'])), ['low', 'medium', 'max'], 'max·xhigh 유지(상한 없음, p64)');
  assert.deepEqual(orchestratorVariants(raw(['default', 'xhigh'])), ['xhigh'], 'default is a shared source, not a variant');
  assert.deepEqual([orchestratorVariants(raw(['default'], ['default'])), orchestratorVariants(raw([]))], [['default'], ['default']]);
});

test('each variant is scored on the all-variant pool; cheaper price wins via value (R)', () => {
  const y = aa('y', INTEL, 60, 1);
  // x-low 89.5·$0.1 vs x-high 90·$10: 성능 .983 vs 1, 가성비 log min-max 1 vs 0 → low 75×.983+15 = 88.8이 high 75.0을 앞선다.
  const near = orch([aa('x-low', INTEL, 89.5, 0.1), aa('x-high', INTEL, 90, 10), y], ['x', 'y']);
  assert.deepEqual(near.map(e => [e.modelId, e.repEffort, e.rawScore?.toFixed(1)]), [['x', 'low', '88.8'], ['y', 'default', '6.3']], 'y 성능은 두 x 변형 풀(60~90)로 표준화된다');
  assert.deepEqual(orch([aa('x-low', INTEL, 85, 0.1), aa('x-high', INTEL, 90, 10), y], ['x', 'y']).map(e => [e.modelId, e.repEffort, e.rawScore?.toFixed(1)]), [['x', 'low', '77.5'], ['y', 'default', '6.4']], 'R에서는 가성비 15점이 성능 차이를 뒤집는다');
});

test('speed 10% and value 15% compose: cheaper low effort leads (R)', () => {
  const records = [aa('m-low', INTEL, 88, 1), aa('m-low', TPS, 400), aa('m-high', INTEL, 90, 1), aa('m-high', TPS, 50),
    aa('z', INTEL, 60, 1), aa('z', TPS, 100)];
  assert.deepEqual(orch(records, ['m', 'z']).map(e => [e.modelId, e.repEffort, e.rawScore?.toFixed(1)]), [['m', 'low', '94.2'], ['z', 'default', '1.4']],
    'R에서 low는 성능 .933×75 + 속도 10 + 가성비 .943×15 = 94.2로 high(85.0)를 앞선다(z는 속도 .143×10만 기여)');
});

test('Cognition USD/task reaches the orchestrator score via reverse max (R)', () => {
  const records = [aa('r-low', INTEL, 88, 10), aa('r-high', INTEL, 90, 1), aa('z', INTEL, 60, 0.05)];
  const withCost = orch(records, ['r', 'z'], [cogCost('r-low', 0.02), cogCost('r-high', 0.5)]), without = orch(records, ['r', 'z']);
  const r = withCost.find(e => e.modelId === 'r')!;
  assert.deepEqual([r.repEffort, r.scoreComponents?.dimensionSources?.price, r.scoreComponents?.sources?.['price:cognition'], r.scoreComponents?.cost], ['low', 'cognition', 1, 1],
    'Cog 비용이 싼 low가 가성비 1로 대표가 된다');
  assert.deepEqual(withCost.map(e => [e.modelId, e.repEffort, e.rawScore?.toFixed(1)]), [['r', 'low', '85.0'], ['z', 'default', '15.0']]);
  assert.deepEqual(without.map(e => [e.modelId, e.repEffort, e.rawScore?.toFixed(1)]), [['r', 'high', '82.3'], ['z', 'default', '15.0']], 'Cog 없으면 AA 가성비로 high가 대표다');
});

test('equal variant scores pick the lower effort', () => {
  const e = orch([aa('t-low', INTEL, 70, 1), aa('t-high', INTEL, 70, 1), aa('u', INTEL, 50, 2)], ['t', 'u']);
  assert.deepEqual(e.map(x => [x.modelId, x.repEffort]), [['t', 'low'], ['u', 'default']]);
});

test('a variant uses only its own effort values, sharing base-common values and leaving others missing', () => {
  // s: AA는 단일 default 80(공유), Cog low .3·high .6 → 두 변형 모두 I 80, Cog 차이로 high.
  // q: tok/s는 q-low 300뿐이지만 오케 속도 결측 대체(전 변형 max)로 high 변형도 300을 쓴다.
  const e = orch([aa('s', INTEL, 80, 1), aa('q-high', INTEL, 90, 1), aa('q-low', INTEL, 70, 1), aa('q-low', TPS, 300)], ['s', 'q'],
    [cog('s-low', 0.3), cog('s-high', 0.6)]);
  const at = (id: string) => e.find(x => x.modelId === id)!;
  assert.deepEqual([at('s').repEffort, at('s').indexText, at('q').repEffort, at('q').scoreComponents?.sources?.['speed:aa']], ['high', '80.0', 'high', 1]);
});

test('worker effort rule is unchanged: best performance effort and base-best AA values', () => {
  const records = [aa('w-a-low', CODE, 60, 1), aa('w-a-high', CODE, 90, 1), aa('w-a-low', INTEL, 60, 1), aa('w-a-high', INTEL, 90, 1), aa('w-b', CODE, 50, 2)];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-a', 'w-b']) });
  const wa = lists.worker.entries.find(x => x.modelId === 'w-a')!;
  assert.deepEqual([wa.repEffort, wa.indexText], ['high', '90.0']);
});
