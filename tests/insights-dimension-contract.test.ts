import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import * as scoreModule from '../src/insights/letter-top10-score.js';
import { PRICE_MISSING, ROLE_WEIGHTS, referenceDimensions, type DimRow } from './helpers/dimension-reference.js';

const IQ = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const COG = 'cognition_correct', COST = 'cognition_cost', DUR = 'cognition_duration_min', OR = 'total_tokens', OC = 'opencode_data_tokens'; type Role = 'orchestrator' | 'worker';
const row = (modelId: string, metric: string, value: number, price?: [number, number]): DimRow => ({ modelId, metric, value, ...(price && { priceInput: price[0], priceOutput: price[1] }) });
const entry = (modelId: string) => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true });
const plan = (planId: string, ids: readonly string[], tier?: 'free'): PlanCatalogEntry => ({ planId, planName: planId, models: ids.map(entry), ...(tier && { tier }) });
/** R 1.2.1: 오케 성능/속도/가성비(75/10/15)·사용량 0, 워커 30/20/10/40+가산. */
const ROLE_W = { orchestrator: { performance: .75, usage: 0, speed: .10, price: .15 }, worker: ROLE_WEIGHTS.worker } as const;
const EVIDENCE = new Set([COG, COST, DUR, OR, OC]);
/** 실제 공개 API(computeRoleTop10)로 계산하고 참조 구현과 같은 입력 행을 쓴다. */
function run(rows: readonly DimRow[], paid: readonly string[], free: readonly string[] = [], role: Role = 'orchestrator') {
  const pick = (m: string[]) => rows.filter(r => m.includes(r.metric!)), aa = rows.filter(r => !EVIDENCE.has(r.metric!));
  const opts = { catalog: [plan('paid', paid)], freeCatalog: free.length ? [plan('zfree', free, 'free')] : [], cognitionRecords: pick([COG, COST, DUR]), openrouterRecords: pick([OR]), opencodeDataRecords: pick([OC]) };
  const list = computeRoleTop10(aa, opts)[role], ref = referenceDimensions(rows, role, new Set(free), ROLE_W[role]);
  return { list, ref, byId: new Map(list.entries.map(e => [e.modelId, e])), refBy: new Map(ref.map(r => [r.modelId, r])) };
}
const W = ROLE_W.orchestrator, score = (e?: { scoreText?: string; rawScore?: number }) => Number(e?.rawScore ?? e?.scoreText); // raw 계약 검증
const near = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) <= 0.051, `${msg} ${a} vs ${b}`);

test('오케 OR·OCD 사용량은 점수에 반영하지 않고 후보 근거로만 유지한다', () => {
  const rows = [row('alpha', IQ, 80), row('bravo', IQ, 40), row('charlie', OR, 1e9), row('delta', OR, 1e6)];
  const { byId } = run(rows, ['alpha', 'bravo', 'charlie', 'delta']); near(score(byId.get('alpha')), 100*W.performance);
  near(score(byId.get('charlie')), 0); assert.equal(byId.get('charlie')!.scoreComponents?.dimensionSources?.usage, 'openrouter');
  near(score(byId.get('delta')), 0, 'OR 토큰 최저는 사용량 0');
  assert.equal(referenceDimensions(rows, 'worker').length, 2, 'intel이 있는 alpha·bravo만 워커 후보(charlie·delta는 intel 없음)');
});
test('오케 가성비는 AA I/(P+.01)와 Cog USD/task를 소스별 max로 반영한다(R)', () => {
  const rows = [row('aa', IQ, 70, [1, 1]), row('noaa', COG, 0.9), row('aa', COG, 0.2), row('noaa', COST, 0), row('noaa', OR, 1e12)];
  const { byId, refBy } = run(rows, ['aa', 'noaa']); const c = byId.get('noaa')!.scoreComponents!;
  assert.equal(c.dimensionSources?.price, 'cognition'); assert.ok(c.sources?.['price:cognition'] !== undefined && c.cost > 0, 'Cog 가성비 반영');
  assert.deepEqual([c.usage, byId.get('aa')!.scoreComponents?.dimensionSources?.price], [1, 'aa']);
  for (const [id,e] of byId) near(score(e), refBy.get(id)!.score, id); // 의존성: 참조헬퍼 I²→I 전까지 FAIL
});
test('오케 가성비는 단가·지능에 따라 변한다: 성능 같으면 단가 낮을수록, 무가격·I=0은 0', () => {
  const rows = [row('alpha', IQ, 80, [1, 1]), row('bravo', IQ, 40, [1, 1]), row('zeroapi', IQ, 40, [0, 0]), row('missing', IQ, 80)];
  const { byId, refBy } = run(rows, ['alpha', 'bravo', 'zeroapi', 'missing']), cost = (id: string) => byId.get(id)!.scoreComponents!.cost, src = (id: string) => byId.get(id)!.scoreComponents?.dimensionSources?.price;
  assert.ok(cost('alpha') > 0 && cost('missing') === 0 && cost('zeroapi') > cost('bravo'), '무가격 결측 0·단가 낮을수록 가성비↑');
  assert.deepEqual(['alpha','bravo','zeroapi','missing'].map(src), ['aa','aa','aa',undefined]);
  for (const [id,e] of byId) near(score(e), refBy.get(id)!.score, id); // 의존성: 참조헬퍼 I²→I 전까지 FAIL
});
test('오케 동일값 Intel·단가는 공통 공유하고 전 변형 최고 점수를 선택한다', () => {
  const rows=[row('a-low',IQ,50,[1,1]),row('a-high',IQ,50,[1,1]),row('a-max',COG,.9),row('b',IQ,80,[1,1]),row('b',COG,.1)]; const { byId }=run(rows,['a','b']);
  assert.equal(byId.get('a')!.repEffort,'max'); assert.equal(byId.get('a')!.blendedCostText,'$1.00/1M'); assert.ok(byId.get('a')!.scoreComponents?.dimensionSources?.price !== undefined, '오케 가성비 소스 등록(a는 풀 최솟값이라 값 0)');
});
test('오케 I=0·가격결측·Free 접근만 근거는 가성비 0, 관측 가격은 가성비 반영(R)', () => {
  const rows=[row('zero',IQ,0,[0,0]),row('no-price',IQ,50),row('known',IQ,50,[1,1])]; const { byId }=run(rows,['zero','no-price','known'],['freeonly']);
  assert.deepEqual(['zero','no-price','freeonly'].map(id=>byId.get(id)!.scoreComponents!.cost),[0,0,0], 'I≤0·무가격·Free 근거는 가성비 0'); assert.ok(byId.get('known')!.scoreComponents!.cost > 0 && byId.get('freeonly')!.scoreComponents?.sources?.['price:missing'] === undefined, '관측가격 known 가성비 반영');
  const cog=run([row('a',IQ,50),row('b',COST,0)],['a','b']); assert.ok(cog.byId.get('b')!.scoreComponents!.cost > 0,'Cog USD/task도 가성비 소스');
});
test('역할별 가중치는 사용자 확정(오케 75/0/10/15·워커 30/20/10/40+가산)이며 워커 가격은 cpt·total 평균이다', () => {
  assert.deepEqual(scoreModule.ROLE_DIMENSION_WEIGHTS,{orchestrator:{performance:.75,usage:0,speed:.10,price:.15},worker:ROLE_WEIGHTS.worker});
  assert.deepEqual(ROLE_WEIGHTS.worker,{performance:.30,usage:.20,speed:.10,price:.40});
  const rows=[row('wa',IQ,70),row('wa',CODE,80,[1,5]),row('wb',IQ,60),row('wb',CODE,80,[.1,.4]),row('wc',IQ,50),row('wc',CODE,80),row('wc',COST,0),row('wc',DUR,1),row('wa',TPS,100),row('wc',OR,1e8)];
  const { byId,refBy }=run(rows,['wa','wb','wc'],[],'worker'); assert.equal(byId.get('wc')!.scoreComponents!.cost,PRICE_MISSING);
  assert.equal(byId.get('wc')!.scoreComponents!.usage,1); assert.equal(byId.get('wc')!.scoreComponents?.sources?.['price:cognition'],undefined);
  for(const [id,e] of byId) near(score(e),refBy.get(id)!.score,id);
});
test('워커 하한은 AA intelligence 원값 33이며 미달을 보충하지 않는다(p85)', () => {
  const rows=[row('a',IQ,100,[1,1]),row('b',IQ,90,[2,2]),row('c',IQ,80,[.1,.1]),row('d',IQ,40,[3,3])];
  const { list,byId,refBy }=run(rows,['a','b','c','d'],[],'worker');
  assert.deepEqual(list.entries.map(e=>e.modelId),['c','a','b','d'], '점수순: c(가격 1) > a > b > d');
  for(const [id,e] of byId) near(score(e),refBy.get(id)!.score,id);
});
test('오케 Cog 시간은 대표 effort만 사용하고 Cog 비용은 점수에 쓰지 않는다(p75)', () => {
  const rows=[row('a-high',IQ,80,[1,1]),row('b-high',IQ,80,[1,1]),row('a-high',DUR,20),row('a-low',DUR,1),row('b-high',DUR,5),row('a-high',COST,0),row('b-high',COST,100)];
  const { byId,refBy }=run(rows,['a','b']); assert.equal(byId.get('a')!.scoreComponents?.sources?.['speed:cognition'],0);
  assert.equal(byId.get('b')!.scoreComponents?.sources?.['speed:cognition'],1); assert.equal(byId.get('a')!.scoreComponents!.cost,byId.get('b')!.scoreComponents!.cost);
  for(const [id,e] of byId) near(score(e),refBy.get(id)!.score,id);
});
test('독립 참조 구현과 의사난수 10모델 풀에서 두 역할의 순위·점수·effort가 일치한다', () => {
  let seed = 5; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647, names = 'abcdefghij'.split('').map(c => `model${c}`), rows: DimRow[] = [];
  for (const id of names) { const eff = rnd() < 0.5 ? 'high' : 'low';
    if (rnd() < 0.6) rows.push(row(`${id}-${eff}`, IQ, rnd() * 90, rnd() < 0.7 ? [rnd() * 5, rnd() * 20] : undefined)); if (rnd() < 0.5) rows.push(row(id, CODE, rnd() * 90)); if (rnd() < 0.5) rows.push(row(id, TPS, 20 + rnd() * 200));
    if (rnd() < 0.5) rows.push(row(`${id}-${eff}`, COG, rnd())); const ce = () => ['', '-high', '-low'][Math.floor(rnd() * 3)]; if (rnd() < 0.4) rows.push(row(id + ce(), COST, rnd() * 3)); if (rnd() < 0.3) rows.push(row(id + ce(), DUR, 1 + rnd() * 60));
    if (rnd() < 0.6) rows.push(row(id, OR, 10 ** (6 + rnd() * 6))); if (rnd() < 0.4) rows.push(row(id, OC, 10 ** (3 + rnd() * 5))); }
  for (const role of ['orchestrator', 'worker'] as Role[]) {
    const cap = (id: string) => rows.some(r => (r.modelId === id || r.modelId.startsWith(`${id}-`)) && Number.isFinite(r.priceInput) && Number.isFinite(r.priceOutput) && (3 * r.priceInput! + r.priceOutput!) / 4 > 5); // $5/M 상한: 알려진 AA 혼합 단가 초과는 존과 무관하게 ▽(미상 허용)
    const { list, ref } = run(rows, names, ['modela', 'modelc'], role), cut = Math.max(0, ...ref.map(r => r.score)) * (role === 'worker' ? 0.60 : 0.85); // ref는 워커 성능 하한 통과자만 담는다
    const below = (r: { score: number; modelId: string }) => r.score < cut || (role === 'worker' && cap(r.modelId));
    const want = [...ref.filter(r => !below(r)), ...ref.filter(r => below(r))].slice(0, 10);
    assert.deepEqual(list.entries.map(e => e.modelId), want.map(r => r.modelId), `${role} 순위`);
    list.entries.forEach((e, k) => { near(score(e), want[k]!.score, `${role} ${e.modelId}`); assert.equal(e.repEffort, want[k]!.effort, `${role} ${e.modelId} effort`); assert.equal(Boolean(e.belowZone), below(want[k]!), `${role} ${e.modelId} zone`); });
  }
});
test('워커 하한 33 경계는 포함한다: 33은 남고 32는 빠진다(p85)', () => {
  const { byId } = run([row('a', IQ, 100), row('b', IQ, 33), row('c', IQ, 32)], ['a', 'b', 'c'], [], 'worker');
  assert.ok(byId.has('b')); assert.ok(!byId.has('c'));
});
test('독립 참조는 전 변형 풀로 표준화하고 점수 상충·동점에서 낮은 effort를 선택한다', () => {
  const rows=[row('x-low',IQ,89.5,[.1,.1]),row('x-low',TPS,400),row('x-high',IQ,90,[10,10]),row('x-high',TPS,50),row('y',IQ,60,[1,1]),row('t-low',IQ,80,[1,1]),row('t-high',IQ,80,[1,1])];
  const {byId,refBy}=run(rows,['x','y','t']); assert.equal(byId.get('x')!.repEffort,'low'); assert.equal(byId.get('t')!.repEffort,'low');
  // R: 가성비(15%)가 x-low 점수에 포함되어 p75 하드코드(82)는 무효 — 정확값은 풀 min-max·참조 대조(의존성)로 검증한다.
  for(const [id,e] of byId) { near(score(e),refBy.get(id)!.score,id); assert.equal(e.repEffort,refBy.get(id)!.effort); }
});
