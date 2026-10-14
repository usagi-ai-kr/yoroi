import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { PRICE_MISSING_VALUE, DIMENSION_LABELS, ROLE_DIMENSIONS, ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, WORKER_INTEL_FLOOR, WORKER_PERFORMANCE_FLOOR } from '../src/insights/letter-top10-score.js';
import { WORKER_BONUS_CAP } from '../src/insights/letter-top10-score-weights.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** p54 C 워커 AA best 소스 + p75 오케 가성비 제거(0.82/0.06/0.12) + p85 워커 AA 3지표 산식(37.5/12.5/50·가산 cap 5·원값 하한 33). 오케 effort 규칙은 insights-orchestrator-effort.test.ts. */
const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const CPT = 'intelligence_index_cost_per_task', TOTAL = 'intelligence_index_total_cost';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'c-test', planName: 'C Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];
const aa = (modelId: string, metric: string, value: number, price?: number): Top10RecordInput =>
  ({ modelId, metric, value, ...(price !== undefined && { priceInput: price, priceOutput: price }) });
const cog = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-3, `${actual} ≈ ${expected}`);

test('role weights, per-role sources, worker floor and bonus cap are exported constants', () => {
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, { orchestrator: { performance: 0.82, usage: 0.06, speed: 0.12 },
    worker: { performance: 0.375, usage: 0, speed: 0.125, price: 0.5 } });
  assert.deepEqual([ROLE_SOURCES.worker.speed, ROLE_SOURCES.worker.price, ROLE_SOURCES.worker.usage, ROLE_SOURCES.orchestrator.speed, ROLE_SOURCES.orchestrator.price,
    ROLE_SOURCES.orchestrator.usage], [['aa'], ['aa'], ['openrouter', 'opencode'], ['aa', 'cognition'], [], ['openrouter', 'opencode']]);
  assert.deepEqual([ROLE_DIMENSIONS.orchestrator, ROLE_DIMENSIONS.worker.map(d => DIMENSION_LABELS[d]).at(-1)], [['performance', 'usage', 'speed'], '가격']);
  assert.deepEqual([WORKER_PERFORMANCE_FLOOR, PRICE_MISSING_VALUE, WORKER_INTEL_FLOOR, WORKER_BONUS_CAP], [0.7, 0.99, 33, 5]);
});

test('worker price falls back to blended cost with a mark when cpt and total are both missing (p85)', () => {
  const rec = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
  const records = [rec('w-x', INTEL, 60), rec('w-x', TPS, 100),
    { modelId: 'w-x', metric: INTEL, value: 60, priceInput: 2, priceOutput: 2 },
    rec('w-y', INTEL, 70), rec('w-y', TPS, 120),
    { modelId: 'w-y', metric: INTEL, value: 70, priceInput: 0.5, priceOutput: 0.5 },
    { modelId: 'w-y', metric: CPT, value: 0.2 }];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-x', 'w-y']) });
  const at = (id: string) => lists.worker.entries.find(x => x.modelId === id)!;
  // w-x: cpt·total 없음 → 혼합 단가 대체 + priceFallback. w-y: cpt만 있어 대체 없음.
  assert.deepEqual([at('w-x').scoreComponents?.priceFallback, at('w-x').scoreComponents?.dimensionSources?.price], [true, 'aa']);
  assert.equal(at('w-y').scoreComponents?.priceFallback, undefined);
  assert.ok((at('w-x').scoreComponents?.sources?.['price:blended'] ?? -1) >= 0);
  assert.equal(at('w-y').scoreComponents?.sources?.['price:blended'], undefined);
});

test('worker p85: intel performance, raw floor 33, price mean(cpt,total), capped bonus', () => {
  const rec = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
  const records = [rec('w-a', INTEL, 60), rec('w-a', TPS, 200), rec('w-a', CPT, 1), rec('w-a', TOTAL, 10),
    rec('w-b', INTEL, 40), rec('w-b', TPS, 100), rec('w-b', CPT, 0.1),
    rec('w-weak', INTEL, 20), rec('w-weak', TPS, 500),
    rec('w-nointel', CODE, 90), rec('w-nointel', TPS, 100)];
  const cognitionRecords = [cog('w-a', 'cognition_correct', 0.8)];
  const openrouterRecords = [{ modelId: 'w-a', metric: 'total_tokens', value: 1000 }, { modelId: 'w-b', metric: 'total_tokens', value: 10 }];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-a', 'w-b', 'w-weak', 'w-nointel']), cognitionRecords, openrouterRecords });
  const w = lists.worker.entries, at = (id: string) => w.find(x => x.modelId === id)!;
  // w-weak(intel 20 < 33)와 w-nointel(intel 없음)은 후보에서 제외된다. 오케에는 하한이 없어 w-weak이 남는다.
  assert.deepEqual(w.map(x => x.modelId).sort(), ['w-a', 'w-b']);
  assert.ok(lists.orchestrator.entries.some(x => x.modelId === 'w-weak'), '원값 하한은 워커 전용이다');
  // w-a: 성능 1·가격 mean(0,1)=0.5 → 37.5+25, 속도 (200-100)/(500-100)=0.25 → +3.1, 가산 5×mean(1,1)=5 → 70.6.
  // 탈락한 w-weak의 tok/s 500이 척도에 남는다(하한은 표준화 뒤에 적용한다).
  assert.deepEqual([at('w-a').scoreText, at('w-a').scoreComponents?.bonus], ['70.6', 5]);
  assert.deepEqual([at('w-a').scoreComponents?.cost, at('w-a').scoreComponents?.dimensionSources?.price], [0.5, 'aa']);
  // w-b: cpt만 있어 가격이 cpt 표준화값 그대로다. 가산 입력은 사용량 0 하나뿐이라 bonus 0이다.
  // 성능 풀에 w-weak 20이 있어 w-b 성능은 0.5 → 68.8로 컷(70.6×0.75=53.0)을 넘는다.
  assert.deepEqual([at('w-b').scoreText, at('w-b').scoreComponents?.cost, at('w-b').scoreComponents?.bonus], ['68.8', 1, 0]);
  assert.equal(at('w-b').belowZone, undefined, 'w-b 68.8 ≥ 최고 70.6×0.75 → 존 통과');
});

test('orchestrator has no price dimension: price never moves the score or the cost component, usage counts lightly (p75)', () => {
  const records = [aa('v-free', INTEL, 80, 0), aa('v-dear', INTEL, 90, 9.99), aa('v-mid', INTEL, 60, 1), aa('v-noprice', INTEL, 70), aa('v-noi', TPS, 100, 0.5)];
  const openrouterRecords = [{ modelId: 'v-dear', metric: 'total_tokens', value: 1e9 }, { modelId: 'v-mid', metric: 'total_tokens', value: 1e3 }];
  const run = (rs: Top10RecordInput[]) => computeRoleTop10(rs, { catalog: catalogOf(['v-free', 'v-dear', 'v-mid', 'v-noprice', 'v-noi']), openrouterRecords }).orchestrator.entries;
  const at = (id: string) => run(records).find(x => x.modelId === id)!, c = (id: string) => at(id).scoreComponents!;
  assert.deepEqual(['v-free', 'v-dear', 'v-mid', 'v-noprice', 'v-noi'].map(id => [c(id).cost, c(id).dimensionSources?.price, c(id).sources?.['price:aa']]), Array(5).fill([0, undefined, undefined]));
  assert.deepEqual([c('v-dear').usage, c('v-dear').sources?.['usage:openrouter'], c('v-dear').dimensionSources?.usage], [1, 1, 'openrouter']);
  assert.equal(at('v-dear').scoreText, (82 + 6).toFixed(1), 'v-dear: 성능 1 + 사용량 1, 속도 근거 없음'); // 성능 82 + 사용량 6
  assert.equal(at('v-mid').scoreText, '0.0', 'v-mid: 성능 0·사용량 0·속도 없음');
  const cheaper = run(records.map(r => ({ ...r, ...(r.priceInput !== undefined && { priceInput: 99, priceOutput: 99 }) })));
  assert.deepEqual(cheaper.map(e => [e.modelId, e.scoreText]), run(records).map(e => [e.modelId, e.scoreText]), 'AA 단가가 바뀌어도 오케 스코어·순위는 같다');
  assert.equal(at('v-free').blendedCostText, '무료', '단가는 표시·파레토용으로 남는다');
});
