import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { PRICE_MISSING_VALUE, ROLE_DIMENSION_LABELS, ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, valueForMoney, WORKER_PERFORMANCE_FLOOR } from '../src/insights/letter-top10-score.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** p54 C 워커 AA best 소스·성능 하한(전체 풀 표준화 후, 재정규화 없음) + p56 오케 가성비 + p64 오케 70/0/15/15·Cog 비용 병기. 오케 effort 규칙은 insights-orchestrator-effort.test.ts. */
const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'c-test', planName: 'C Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];
const aa = (modelId: string, metric: string, value: number, price?: number): Top10RecordInput =>
  ({ modelId, metric, value, ...(price !== undefined && { priceInput: price, priceOutput: price }) });
const cog = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-3, `${actual} ≈ ${expected}`);

test('role weights, per-role sources and the worker floor are exported constants', () => {
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, { orchestrator: { performance: 0.7, usage: 0.05, speed: 0.1, price: 0.15 },
    worker: { performance: 0.3, usage: 0.2, speed: 0.1, price: 0.4 } });
  assert.deepEqual([ROLE_SOURCES.worker.speed, ROLE_SOURCES.worker.price, ROLE_SOURCES.worker.usage, ROLE_SOURCES.orchestrator.speed, ROLE_SOURCES.orchestrator.price,
    ROLE_SOURCES.orchestrator.usage], [['aa'], ['aa'], ['openrouter', 'opencode'], ['aa', 'cognition'], ['aa', 'cognition'], ['openrouter', 'opencode']]);
  assert.deepEqual([ROLE_DIMENSION_LABELS.orchestrator.price, ROLE_DIMENSION_LABELS.worker.price], ['가성비', '가격']);
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

test('orchestrator value-for-money = I²/(P+0.01), log10 min-max; I/P missing → 0; observed price 0 is valid; usage counts lightly (p70)', () => {
  assert.equal(valueForMoney(90, 2), 8100 / 2.01); assert.equal(valueForMoney(50, 0), 2500 / 0.01);
  assert.deepEqual([valueForMoney(undefined, 1), valueForMoney(80, undefined), valueForMoney(0, 1)], [undefined, undefined, undefined]);
  const records = [aa('v-free', INTEL, 80, 0), aa('v-dear', INTEL, 90, 9.99), aa('v-mid', INTEL, 60, 1), aa('v-noprice', INTEL, 70), aa('v-noi', TPS, 100, 0.5)];
  const openrouterRecords = [{ modelId: 'v-dear', metric: 'total_tokens', value: 1e9 }, { modelId: 'v-mid', metric: 'total_tokens', value: 1e3 }];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['v-free', 'v-dear', 'v-mid', 'v-noprice', 'v-noi']), openrouterRecords });
  const at = (id: string) => lists.orchestrator.entries.find(x => x.modelId === id)!.scoreComponents!;
  const lg = (i: number, p: number) => Math.log10(i ** 2 / (p + 0.01)), lo = lg(90, 9.99), hi = lg(80, 0);
  assert.deepEqual([at('v-free').cost, at('v-dear').cost], [1, 0]);
  near(at('v-mid').cost, (lg(60, 1) - lo) / (hi - lo));
  assert.deepEqual([at('v-noprice').cost, at('v-noi').cost, at('v-noprice').sources?.['price:missing']], [0, 0, undefined]);
  assert.deepEqual([at('v-dear').usage, at('v-dear').sources?.['usage:openrouter'], at('v-dear').dimensionSources?.usage], [1, 1, 'openrouter']);
  // v-mid: 성능 0(Intelligence 최저 60)·속도 없음·사용량 0(OR 최저) → 스코어 = 15 × 가성비 차원값(p70 가중치).
  assert.equal(lists.orchestrator.entries.find(x => x.modelId === 'v-mid')!.scoreText, (15 * (lg(60, 1) - lo) / (hi - lo)).toFixed(1));
});

test('orchestrator value-for-money: I = 0 gives Q = 0 → dimension 0 like missing, excluded from the min-max scale', () => {
  const base = [aa('q-free', INTEL, 80, 0), aa('q-dear', INTEL, 90, 9.99), aa('q-mid', INTEL, 60, 1)], catalog = catalogOf(['q-free', 'q-dear', 'q-mid', 'q-zero']);
  const costs = (records: Top10RecordInput[]) => Object.fromEntries(computeRoleTop10(records, { catalog }).orchestrator.entries.map(e => [e.modelId, e.scoreComponents?.cost]));
  const without = costs(base), withZero = costs([...base, aa('q-zero', INTEL, 0, 0.01)]);
  assert.deepEqual([withZero['q-zero'], valueForMoney(0, 0.01)], [0, undefined], 'log10(0) is never taken');
  for (const id of ['q-free', 'q-dear', 'q-mid']) assert.equal(withZero[id], without[id], `${id} scale unchanged`);
});
