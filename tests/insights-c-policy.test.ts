import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { PRICE_MISSING_VALUE, DIMENSION_LABELS, ROLE_DIMENSIONS, ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, WORKER_PERFORMANCE_FLOOR } from '../src/insights/letter-top10-score.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** p54 C 워커 AA best 소스·성능 하한(전체 풀 표준화 후, 재정규화 없음) + p75 오케 가성비 제거(0.82/0.06/0.12). 오케 effort 규칙은 insights-orchestrator-effort.test.ts. */
const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'c-test', planName: 'C Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];
const aa = (modelId: string, metric: string, value: number, price?: number): Top10RecordInput =>
  ({ modelId, metric, value, ...(price !== undefined && { priceInput: price, priceOutput: price }) });
const cog = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-3, `${actual} ≈ ${expected}`);

test('role weights, per-role sources and the worker floor are exported constants', () => {
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, { orchestrator: { performance: 0.82, usage: 0.06, speed: 0.12 },
    worker: { performance: 0.3, usage: 0.2, speed: 0.1, price: 0.4 } });
  assert.deepEqual([ROLE_SOURCES.worker.speed, ROLE_SOURCES.worker.price, ROLE_SOURCES.worker.usage, ROLE_SOURCES.orchestrator.speed, ROLE_SOURCES.orchestrator.price,
    ROLE_SOURCES.orchestrator.usage], [['aa'], ['aa'], ['openrouter', 'opencode'], ['aa', 'cognition'], [], ['openrouter', 'opencode']]);
  assert.deepEqual([ROLE_DIMENSIONS.orchestrator, ROLE_DIMENSIONS.worker.map(d => DIMENSION_LABELS[d]).at(-1)], [['performance', 'usage', 'speed'], '가격']);
  assert.deepEqual([WORKER_PERFORMANCE_FLOOR, PRICE_MISSING_VALUE], [0.7, 0.99]);
});

test('worker: AA best speed/price only, Cognition time/cost ignored, floor after full-pool standardization without renormalizing', () => {
  const records = [aa('w-fast-low', CODE, 90, 1), aa('w-fast-low', TPS, 300), aa('w-fast-max', CODE, 95, 1), aa('w-fast-max', TPS, 100),
    aa('w-cheap', CODE, 85, 0.1), aa('w-cheap', TPS, 50), aa('w-weak', CODE, 40, 0), aa('w-weak', TPS, 500), aa('w-noprice', CODE, 92), aa('w-noprice', TPS, 100)];
  const cognitionRecords = [cog('w-cheap', 'cognition_duration_min', 1), cog('w-cheap', 'cognition_cost', 0.001)];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-fast', 'w-cheap', 'w-weak', 'w-noprice']), cognitionRecords });
  const w = lists.worker.entries, at = (id: string) => w.find(x => x.modelId === id)!;
  assert.deepEqual(w.map(x => x.modelId).sort(), ['w-cheap', 'w-fast', 'w-noprice'], 'w-weak (performance 0 < .70) never fills a row');
  assert.ok(lists.orchestrator.entries.some(x => x.modelId === 'w-weak'), 'the floor is worker-only');
  near(at('w-fast').scoreComponents?.sources?.['speed:aa'], (300 - 50) / (500 - 50)); // AA best 300, 탈락한 w-weak 500이 척도에 남는다
  near(at('w-cheap').scoreComponents?.index, (85 - 40) / (95 - 40));
  assert.deepEqual([at('w-cheap').scoreComponents?.sources?.['speed:cognition'], at('w-cheap').scoreComponents?.sources?.['price:cognition']], [undefined, undefined]);
  assert.deepEqual([at('w-noprice').scoreComponents?.cost, at('w-noprice').scoreComponents?.dimensionSources?.price], [PRICE_MISSING_VALUE, 'missing']);
  assert.equal(at('w-fast').scoreComponents?.sources?.['price:aa'], 0);
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
