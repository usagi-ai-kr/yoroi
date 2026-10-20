import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { PRICE_MISSING_VALUE, DIMENSION_LABELS, ROLE_DIMENSIONS, ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, WORKER_INTEL_FLOOR, WORKER_PERFORMANCE_FLOOR } from '../src/insights/letter-top10-score.js';
import { WORKER_BONUS_CAP } from '../src/insights/letter-top10-score-weights.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { UNCONSTRAINED_AVAILABILITY } from '../src/insights/letter-effort-availability.js';

/** R(1.2.1) 오케 0.75/0/0.10/0.15, 워커 .30/.20/.10/.40+가산. */
const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const CPT = 'intelligence_index_cost_per_task', TOTAL = 'intelligence_index_total_cost';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'c-test', planName: 'C Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];
const aa = (modelId: string, metric: string, value: number, price?: number): Top10RecordInput =>
  ({ modelId, metric, value, ...(price !== undefined && { priceInput: price, priceOutput: price }) });
const cog = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
const near = (actual: number | undefined, expected: number) => assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-3, `${actual} ≈ ${expected}`);

test('role weights, per-role sources, worker floor and bonus cap are exported constants', () => {
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, { orchestrator: { performance: 0.75, usage: 0, speed: 0.10, price: 0.15 },
    worker: { performance: 0.30, usage: 0.20, speed: 0.10, price: 0.40 } });
  assert.deepEqual([ROLE_SOURCES.worker.speed, ROLE_SOURCES.worker.price, ROLE_SOURCES.worker.usage, ROLE_SOURCES.orchestrator.speed, ROLE_SOURCES.orchestrator.price,
    ROLE_SOURCES.orchestrator.usage], [['aa'], ['aa'], ['openrouter', 'opencode'], ['aa', 'cognition'], ['aa', 'cognition'], ['openrouter', 'opencode']]);
  assert.deepEqual([ROLE_DIMENSIONS.orchestrator, ROLE_DIMENSIONS.worker.map(d => DIMENSION_LABELS[d]).at(-1)], [['performance', 'usage', 'speed', 'price'], '가격']);
  assert.deepEqual([WORKER_PERFORMANCE_FLOOR, PRICE_MISSING_VALUE, WORKER_INTEL_FLOOR, WORKER_BONUS_CAP], [0.7, 0.99, 33, 5]);
});

test('worker price falls back to blended cost with a mark when cpt and total are both missing (p85)', () => {
  const rec = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
  const records = [rec('w-x', INTEL, 60), rec('w-x', TPS, 100),
    { modelId: 'w-x', metric: INTEL, value: 60, priceInput: 2, priceOutput: 2 },
    rec('w-y', INTEL, 70), rec('w-y', TPS, 120),
    { modelId: 'w-y', metric: INTEL, value: 70, priceInput: 0.5, priceOutput: 0.5 },
    { modelId: 'w-y', metric: CPT, value: 0.2 }];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-x', 'w-y']), effortAvailability: UNCONSTRAINED_AVAILABILITY});
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
  const lists = computeRoleTop10(records, { catalog: catalogOf(['w-a', 'w-b', 'w-weak', 'w-nointel']), cognitionRecords, openrouterRecords, effortAvailability: UNCONSTRAINED_AVAILABILITY});
  const w = lists.worker.entries, at = (id: string) => w.find(x => x.modelId === id)!;
  // w-weak(intel 20 < 33)와 w-nointel(intel 없음)은 후보에서 제외된다. 오케에는 하한이 없어 w-weak이 남는다.
  assert.deepEqual(w.map(x => x.modelId).sort(), ['w-a', 'w-b']);
  assert.ok(lists.orchestrator.entries.some(x => x.modelId === 'w-weak'), '원값 하한은 워커 전용이다');
  // w-a: 성능 1·사용량 1·가격 mean(0,1)=0.5 → 30+20+20, 속도 (200-100)/(500-100)=0.25 → +2.5, 가산 5×mean(1,1)=5 → 77.5.
  // 탈락한 w-weak의 tok/s 500이 척도에 남는다(하한은 표준화 뒤에 적용한다).
  assert.deepEqual([at('w-a').rawScore?.toFixed(1), at('w-a').scoreComponents?.bonus], ['77.5', 5]);
  assert.deepEqual([at('w-a').scoreComponents?.cost, at('w-a').scoreComponents?.dimensionSources?.price], [0.5, 'aa']);
  // w-b: cpt만 있어 가격이 cpt 표준화값 그대로다. 가산 입력은 사용량 0 하나뿐이라 bonus 0이다.
  // 성능 풀에 w-weak 20이 있어 w-b 성능은 0.5 → 55.0으로 컷(77.5×0.60=46.5)을 넘는다.
  assert.deepEqual([at('w-b').rawScore?.toFixed(1), at('w-b').scoreComponents?.cost, at('w-b').scoreComponents?.bonus], ['55.0', 1, 0]);
  assert.equal(at('w-b').belowZone, undefined, 'w-b 55.0 ≥ 최고 77.5×0.60 → 존 통과');
});

test('orchestrator price dimension moves the score: same intel, cheaper wins via linear value (R)', () => {
  const records = [aa('o-cheap', INTEL, 80, 1), aa('o-dear', INTEL, 80, 9)];
  const run = (rs: Top10RecordInput[]) => computeRoleTop10(rs, { catalog: catalogOf(['o-cheap', 'o-dear']), effortAvailability: UNCONSTRAINED_AVAILABILITY}).orchestrator.entries;
  const at = (id: string) => run(records).find(x => x.modelId === id)!, c = (id: string) => at(id).scoreComponents!;
  // orchValue cheap=80/1.01, dear=80/9.01 → log10 min-max 1 vs 0. usage는 0 가중치.
  // cheap: 75×1 + 15×1 = 90.0, dear: 75×1 + 15×0 = 75.0.
  assert.deepEqual([at('o-cheap').rawScore?.toFixed(1), at('o-dear').rawScore?.toFixed(1)], ['90.0', '75.0']);
  assert.deepEqual([c('o-cheap').cost, c('o-cheap').dimensionSources?.price], [1, 'aa']);
  assert.deepEqual([c('o-dear').cost, c('o-dear').dimensionSources?.price], [0, 'aa']);
  const dearer = run(records.map(r => ({ ...r, priceInput: 99, priceOutput: 99 })));
  assert.deepEqual(dearer.map(e => [e.modelId, e.rawScore?.toFixed(1)]), [['o-cheap', '90.0'], ['o-dear', '90.0']], '둘 다 99면 가성비 동점 1 → 순위·점수 동일');
  assert.equal(at('o-cheap').blendedCostText, '$1.00/1M', '단가는 표시·파레토용으로 남는다');
});

test('speed falls back between role definitions while preserving AA priority', () => {
  const oo = computeRoleTop10([aa('oa-high', INTEL, 70), aa('oa-low', TPS, 100), aa('ob-high', INTEL, 80), aa('ob-high', TPS, 200)], { catalog: catalogOf(['oa', 'ob']), effortAvailability: UNCONSTRAINED_AVAILABILITY}).orchestrator.entries.find(e => e.modelId === 'oa')!;
  assert.ok(oo.scoreComponents?.sources?.['speed:aa'] !== undefined);
  const ww = computeRoleTop10([aa('wa', INTEL, 60), aa('wb', INTEL, 70), aa('wc', INTEL, 80), aa('wc', TPS, 300)], { catalog: catalogOf(['wa', 'wb', 'wc']), cognitionRecords: [cog('wa', 'cognition_duration_min', 40), cog('wb', 'cognition_duration_min', 20)], effortAvailability: UNCONSTRAINED_AVAILABILITY}).worker.entries;
  const a = ww.find(e => e.modelId === 'wa')!, b = ww.find(e => e.modelId === 'wb')!, c = ww.find(e => e.modelId === 'wc')!;
  assert.deepEqual([a.scoreComponents?.sources?.['speed:cognition'], a.scoreComponents?.dimensionSources?.speed], [0, 'cognition']);
  assert.deepEqual([b.scoreComponents?.sources?.['speed:cognition'], b.scoreComponents?.dimensionSources?.speed], [1, 'cognition']);
  assert.deepEqual([c.scoreComponents?.sources?.['speed:aa'], c.scoreComponents?.sources?.['speed:cognition'], c.scoreComponents?.dimensionSources?.speed], [1, undefined, 'aa']);
});
