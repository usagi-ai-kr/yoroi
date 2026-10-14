import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import * as scoreModule from '../src/insights/letter-top10-score.js';
import { PRICE_MISSING, ROLE_WEIGHTS, referenceDimensions, type DimRow } from './helpers/dimension-reference.js';

const IQ = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', TPS = 'median_output_tokens_per_second';
const COG = 'cognition_correct', COST = 'cognition_cost', DUR = 'cognition_duration_min', OR = 'total_tokens', OC = 'opencode_data_tokens';
type Role = 'orchestrator' | 'worker';
const row = (modelId: string, metric: string, value: number, price?: [number, number]): DimRow => ({ modelId, metric, value, ...(price && { priceInput: price[0], priceOutput: price[1] }) });
const entry = (modelId: string) => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true });
const plan = (planId: string, ids: readonly string[], tier?: 'free'): PlanCatalogEntry => ({ planId, planName: planId, ...(tier && { tier }), models: ids.map(entry) });
const EVIDENCE = new Set([COG, COST, DUR, OR, OC]);
/** 실제 공개 API(computeRoleTop10)로 계산하고 참조 구현과 같은 입력 행을 쓴다. */
function run(rows: readonly DimRow[], paid: readonly string[], free: readonly string[] = [], role: Role = 'orchestrator') {
  const pick = (m: string[]) => rows.filter(r => m.includes(r.metric!)), aa = rows.filter(r => !EVIDENCE.has(r.metric!));
  const opts = { catalog: [plan('paid', paid)], freeCatalog: free.length ? [plan('zfree', free, 'free')] : [], cognitionRecords: pick([COG, COST, DUR]), openrouterRecords: pick([OR]), opencodeDataRecords: pick([OC]) };
  const list = computeRoleTop10(aa, opts)[role], ref = referenceDimensions(rows, role, new Set(free));
  return { list, ref, byId: new Map(list.entries.map(e => [e.modelId, e])), refBy: new Map(ref.map(r => [r.modelId, r])) };
}
const W = ROLE_WEIGHTS.orchestrator, score = (e?: { scoreText?: string }) => Number(e?.scoreText);
const near = (a: number, b: number, msg = '') => assert.ok(Math.abs(a - b) <= 0.051, `${msg} ${a} vs ${b}`);

test('오케도 OR·OCD 사용량을 점수·소스 기여로 반영한다(p70) — 워커처럼 후보를 유지한다', () => {
  const rows = [row('alpha', IQ, 80), row('bravo', IQ, 40), row('charlie', OR, 1e9), row('delta', OR, 1e6)];
  const { byId } = run(rows, ['alpha', 'bravo', 'charlie', 'delta']); near(score(byId.get('alpha')), 100*W.performance);
  near(score(byId.get('charlie')), 100*W.usage); assert.equal(byId.get('charlie')!.scoreComponents?.dimensionSources?.usage, 'openrouter');
  near(score(byId.get('delta')), 0, 'OR 토큰 최저는 사용량 0');
  assert.equal(referenceDimensions(rows, 'worker').length, 0, '성능 근거 없는 워커는 품질 하한 제외');
});
test('AA 결측도 Cog 성능으로 평가하고, 오케 가성비는 I/P 결측0이며 Cog USD/task 소스도 함께 쓴다(p66) — 오케 사용량 반영(p70)', () => {
  const rows = [row('aa', IQ, 70, [1, 1]), row('noaa', COG, 0.9), row('aa', COG, 0.2), row('noaa', COST, 0), row('noaa', OR, 1e12)];
  const { byId, refBy } = run(rows, ['aa', 'noaa']); const c = byId.get('noaa')!.scoreComponents!;
  assert.deepEqual([c.index, c.cost, c.usage, c.sources?.['price:missing'], c.sources?.['price:cognition']], [1, 1, 1, undefined, 1]); near(score(byId.get('noaa')), refBy.get('noaa')!.score);
});
test('가성비는 대표 effort AA I²/(P+.01)의 log min-max이며 싼 단가 자체와 다르다', () => {
  const rows = [row('alpha', IQ, 80, [1, 1]), row('bravo', IQ, 40, [1, 1]), row('zeroapi', IQ, 40, [0, 0]), row('missing', IQ, 80)];
  const { byId, refBy } = run(rows, ['alpha', 'bravo', 'zeroapi', 'missing']); const lg = (I: number, P: number) => Math.log10(I*I/(P+.01));
  const lo=lg(40,1), hi=lg(40,0); near(byId.get('alpha')!.scoreComponents!.cost, (lg(80,1)-lo)/(hi-lo));
  assert.deepEqual(['bravo','zeroapi','missing'].map(id=>byId.get(id)!.scoreComponents!.cost), [0,1,0]);
  assert.equal(byId.get('missing')!.scoreComponents?.dimensionSources?.price, undefined);
  for (const [id,e] of byId) near(score(e), refBy.get(id)!.score, id);
});
test('오케 동일값 Intel과 단가는 공통 공유하고 전 변형 최고 점수를 선택한다', () => {
  const rows=[row('a-low',IQ,50,[1,1]),row('a-high',IQ,50,[1,1]),row('a-max',COG,.9),row('b',IQ,80,[1,1]),row('b',COG,.1)];
  const { byId }=run(rows,['a','b']); assert.equal(byId.get('a')!.repEffort,'max'); assert.equal(byId.get('a')!.blendedCostText,'$1.00/1M');
  assert.equal(byId.get('a')!.scoreComponents!.cost,0); assert.equal(byId.get('a')!.scoreComponents?.sources?.['price:aa'],0);
});
test('오케 I=0·가격결측·Free 접근만 근거는 가성비0, pool 전체 무가성비도0', () => {
  const rows=[row('zero',IQ,0,[0,0]),row('no-price',IQ,50),row('known',IQ,50,[1,1])]; const { byId }=run(rows,['zero','no-price','known'],['freeonly']);
  assert.deepEqual(['zero','no-price','freeonly'].map(id=>byId.get(id)!.scoreComponents!.cost),[0,0,0]);
  assert.equal(byId.get('known')!.scoreComponents!.cost,1); assert.equal(byId.get('freeonly')!.scoreComponents?.sources?.['price:missing'],undefined);
  const none=run([row('a',IQ,50),row('b',COST,0)],['a','b']); assert.deepEqual(none.list.entries.map(e=>[e.modelId,e.scoreComponents!.cost]),[['a',0],['b',1]],'Cog USD/task 단독 근거도 p64부터 가성비 근거다');
});
test('역할별 가중치는 p70(오케 70/5/10/15)이며 워커는 AA 가격·속도와 사용량을 그대로 반영한다', () => {
  assert.deepEqual(scoreModule.ROLE_DIMENSION_WEIGHTS,ROLE_WEIGHTS); assert.deepEqual(ROLE_WEIGHTS.orchestrator,{performance:.7,usage:.05,speed:.1,price:.15});
  const rows=[row('wa',CODE,80,[1,5]),row('wb',CODE,80,[.1,.4]),row('wc',CODE,80),row('wc',COST,0),row('wc',DUR,1),row('wa',TPS,100),row('wc',OR,1e8)];
  const { byId,refBy }=run(rows,['wa','wb','wc'],[],'worker'); assert.equal(byId.get('wc')!.scoreComponents!.cost,PRICE_MISSING);
  assert.equal(byId.get('wc')!.scoreComponents!.usage,1); assert.equal(byId.get('wc')!.scoreComponents?.sources?.['price:cognition'],undefined);
  for(const [id,e] of byId) near(score(e),refBy.get(id)!.score,id);
});
test('워커 성능 하한은 전체 풀 표준화 후 적용하며 미달을 보충하지 않는다', () => {
  const rows=[row('a',CODE,100,[1,1]),row('b',CODE,90,[2,2]),row('c',CODE,80,[.1,.1]),row('d',CODE,40,[3,3])];
  const { list,byId,refBy }=run(rows,['a','b','c','d'],[],'worker'); assert.deepEqual(list.entries.map(e=>e.modelId),['a','b']);
  for(const [id,e] of byId) near(score(e),refBy.get(id)!.score,id);
});
test('오케 Cog 시간은 대표 effort만 사용하고 Cog 비용은 p64부터 가성비에 참여한다', () => {
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
    const { list, ref } = run(rows, names, ['modela', 'modelc'], role), cut = Math.max(0, ...ref.map(r => r.score)) * (role === 'worker' ? 0.75 : 0.85); // ref는 워커 성능 하한 통과자만 담는다
    const want = [...ref.filter(r => r.score >= cut), ...ref.filter(r => r.score < cut)].slice(0, 10);
    assert.deepEqual(list.entries.map(e => e.modelId), want.map(r => r.modelId), `${role} 순위`);
    list.entries.forEach((e, k) => { near(score(e), want[k]!.score, `${role} ${e.modelId}`); assert.equal(e.repEffort, want[k]!.effort, `${role} ${e.modelId} effort`); assert.equal(Boolean(e.belowZone), want[k]!.score < cut); });
  }
});
test('워커 품질 하한은 정확히 .70인 경계를 포함한다', () => {
  const { byId } = run([row('a', CODE, 100), row('b', CODE, 70), row('c', CODE, 0)], ['a', 'b', 'c'], [], 'worker');
  assert.ok(byId.has('b')); assert.equal(byId.get('b')!.scoreComponents?.index, 0.7); assert.ok(!byId.has('c'));
});
test('독립 참조는 전 변형 풀로 표준화하고 점수 상충·동점에서 낮은 effort를 선택한다', () => {
  const rows=[row('x-low',IQ,89.5,[.1,.1]),row('x-high',IQ,90,[10,10]),row('y',IQ,60,[1,1]),row('t-low',IQ,80,[1,1]),row('t-high',IQ,80,[1,1])];
  const {byId,refBy}=run(rows,['x','y','t']); assert.equal(byId.get('x')!.repEffort,'low'); assert.equal(byId.get('t')!.repEffort,'low');
  near(score(byId.get('x')),70*(89.5-60)/30+15);
  for(const [id,e] of byId) { near(score(e),refBy.get(id)!.score,id); assert.equal(e.repEffort,refBy.get(id)!.effort); }
});
