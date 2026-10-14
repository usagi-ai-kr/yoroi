import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { orchestratorVariants, type Raw } from '../src/insights/letter-top10-score-raw.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** p70(2026-10-14 사용자 확정): 오케 가중치 70/5/10/15, effort 상한 없음, 가성비=max(AA I²/P, Cog USD/task) 소스별 표준화. */
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
const lg = (i: number, p: number) => Math.log10(i ** 2 / (p + 0.01));

test('variants are the observed performance-source efforts in order; default only when it is the sole observation', () => {
  assert.deepEqual(orchestratorVariants(raw(['max', 'low'], ['medium'])), ['low', 'medium', 'max'], 'max·xhigh 유지(상한 없음, p64)');
  assert.deepEqual(orchestratorVariants(raw(['default', 'xhigh'])), ['xhigh'], 'default is a shared source, not a variant');
  assert.deepEqual([orchestratorVariants(raw(['default'], ['default'])), orchestratorVariants(raw([]))], [['default'], ['default']]);
});

test('each variant is scored on the all-variant pool; speed and value together keep the cheaper variant ahead', () => {
  const y = aa('y', INTEL, 60, 1);
  // x-low 89.5·$0.1 vs x-high 90·$10: 성능 .983 vs 1, 가성비 1 vs 0 → low 70×.9833+15 = 83.8 > high 70.0.
  const near = orch([aa('x-low', INTEL, 89.5, 0.1), aa('x-high', INTEL, 90, 10), y], ['x', 'y']);
  assert.deepEqual(near.map(e => [e.modelId, e.repEffort, e.scoreText]), [['x', 'low', '83.8'], ['y', 'default', (15 * (lg(60, 1) - lg(90, 10)) / (lg(89.5, 0.1) - lg(90, 10))).toFixed(1)]],
    'y value-for-money is scaled by both x variants (min from x-high, max from x-low)');
  // p70: 가성비 15%가 성능 차를 뒤집는다. x-low 85·$0.1은 low 70×.8333+15 = 73.3 > high 70.0(P1 95% 시절엔 high가 이겼다).
  assert.deepEqual(orch([aa('x-low', INTEL, 85, 0.1), aa('x-high', INTEL, 90, 10), y], ['x', 'y'])[0]!.repEffort, 'low');
});

test('speed 10% lets the lower effort lead when the high effort is far slower (p70)', () => {
  const records = [aa('m-low', INTEL, 88, 1), aa('m-low', TPS, 400), aa('m-high', INTEL, 90, 1), aa('m-high', TPS, 50),
    aa('z', INTEL, 60, 1), aa('z', TPS, 100)];
  assert.deepEqual(orch(records, ['m', 'z']).map(e => [e.modelId, e.repEffort, e.scoreText]), [['m', 'low', '89.5'], ['z', 'default', '1.4']],
    'P1 95%에서는 high가 이기지만 70/5/10/15에서는 속도·가성비가 low를 대표로 만든다(z는 속도 .143만 기여)');
});

test('Cognition USD/task joins orchestrator value-for-money per source and can flip the representative (p66 확정)', () => {
  const records = [aa('r-low', INTEL, 88, 10), aa('r-high', INTEL, 90, 1), aa('z', INTEL, 60, 0.05)];
  const r = orch(records, ['r', 'z'], [cogCost('r-low', 0.02), cogCost('r-high', 0.5)]).find(e => e.modelId === 'r')!;
  assert.deepEqual([r.repEffort, r.scoreComponents?.dimensionSources?.price, r.scoreComponents?.sources?.['price:cognition']],
    ['low', 'cognition', 1], 'Cog 비용이 더 싼 low 변형이 가성비 차원을 이끌어 대표가 된다(AA 가성비만이면 high)');
});

test('가성비 단위(USD/1M vs USD/task)는 섞지 않는다: 소스별 표준화 후 차원 max, 값은 0..1 (p66 확정)', () => {
  const records = [aa('x', INTEL, 80, 1), aa('y', INTEL, 80, 10), aa('z', INTEL, 80, 3.17)];
  const entries = orch(records, ['x', 'y', 'z'], [cogCost('x', 1000), cogCost('y', 0.0001), cogCost('z', 0.316)]);
  const at = (id: string) => entries.find(e => e.modelId === id)!;
  assert.deepEqual(['x', 'y', 'z'].map(id => at(id).scoreComponents?.dimensionSources?.price), ['aa', 'cognition', 'cognition'],
    '한 소스만 좋아도 차원 값은 두 표준화 값의 max이고, 원값 1000 USD/task가 척도를 키우지 않는다');
  assert.deepEqual([at('x').scoreComponents?.cost, at('y').scoreComponents?.cost], [1, 1]);
  assert.ok(Math.abs((at('z').scoreComponents?.cost ?? 0) - 0.698) < 0.01, String(at('z').scoreComponents?.cost));
  assert.ok(entries.every(e => (e.scoreComponents?.cost ?? 0) <= 1 && Number(e.scoreText) <= 100), '단위 혼합 없이 차원 0..1·점수 100 상한');
});

test('equal variant scores pick the lower effort', () => {
  const e = orch([aa('t-low', INTEL, 70, 1), aa('t-high', INTEL, 70, 1), aa('u', INTEL, 50, 2)], ['t', 'u']);
  assert.deepEqual(e.map(x => [x.modelId, x.repEffort]), [['t', 'low'], ['u', 'default']]);
});

test('a variant uses only its own effort values, sharing base-common values and leaving others missing', () => {
  // s: AA는 단일 default 80(공유), Cog low .3·high .6 → 두 변형 모두 I 80, Cog 차이로 high.
  // q: tok/s는 q-low 300만 있어(단일 non-default) high 변형에 공유되지 않는다.
  const e = orch([aa('s', INTEL, 80, 1), aa('q-high', INTEL, 90, 1), aa('q-low', INTEL, 70, 1), aa('q-low', TPS, 300)], ['s', 'q'],
    [cog('s-low', 0.3), cog('s-high', 0.6)]);
  const at = (id: string) => e.find(x => x.modelId === id)!;
  assert.deepEqual([at('s').repEffort, at('s').indexText, at('q').repEffort, at('q').scoreComponents?.sources?.['speed:aa']], ['high', '80.0', 'high', undefined]);
});

test('worker effort rule is unchanged: best performance effort and base-best AA values', () => {
  const records = [aa('w-a-low', CODE, 60, 1), aa('w-a-high', CODE, 90, 1), aa('w-a-low', INTEL, 60, 1), aa('w-a-high', INTEL, 90, 1), aa('w-b', CODE, 50, 2)];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-a', 'w-b']) });
  const wa = lists.worker.entries.find(x => x.modelId === 'w-a')!;
  assert.deepEqual([wa.repEffort, wa.indexText], ['high', '90.0']);
});
