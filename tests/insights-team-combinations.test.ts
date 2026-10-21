import assert from 'node:assert/strict';
import test from 'node:test';
import { unionPool } from '../src/insights/letter-team-runners.js';
import { buildTeamCombinations, loadOpenWeightKeys } from '../src/insights/letter-team-combinations.js';

/** #253/#261: 권장 조합 — 슬롯 구성·유일성·합산 최적·부족·동점·Free 필터. */
const cand = (modelId: string, score: number, effort = 'default') =>
  ({ modelId, baseModelId: modelId, identityKey: modelId, score, effort });
const top7 = (o: number, r: number, w: number) => ({
  orchestrator: Array.from({ length: o }, (_, i) => cand(`o${i + 1}`, 90 - i)),
  reviewer: Array.from({ length: r }, (_, i) => cand(`r${i + 1}`, 85 - i)),
  worker: Array.from({ length: w }, (_, i) => cand(`w${i + 1}`, 80 - i)) });
const models = (slots: readonly { modelId: string }[]) => slots.map(s => s.modelId);

test('4조합 + 슬롯 수 1+1+3(5)·1+2(3)', () => {
  const combos = buildTeamCombinations({ top15: top7(2, 2, 3) });
  assert.deepEqual([combos.length, combos.map(c => c.key)], [4, ['best-1+1+3', 'best-1+2', 'open-1+1+3', 'open-1+2']]);
  assert.deepEqual([[combos[0]!.slots.length, combos[1]!.slots.length], combos[1]!.slots.map(s => s.role)],
    [[5, 3], ['orchestrator', 'worker', 'worker']]);
});

test('조합 안에서 동일 identityKey 는 1회만', () => {
  const shared = cand('shared', 90);
  const combos = buildTeamCombinations({ top15: { orchestrator: [shared, cand('o2', 40)],
    reviewer: [shared, cand('r2', 39)], worker: [cand('w1', 30), cand('w2', 29), cand('w3', 28)] } });
  const keys = combos[0]!.slots.map(s => s.modelId);
  assert.equal(new Set(keys).size, keys.length, '조합 내 중복 없음');
});

test('합산 점수 최대 — 그리디로 먼저 고르면 조합이 막히는 경우를 찾는다', () => {
  const a = cand('A', 90), b = cand('B', 30);
  const combos = buildTeamCombinations({ top15: { orchestrator: [a, b], reviewer: [cand('R', 85)],
    worker: [cand('A', 80), cand('C', 70), cand('D', 60)] } });
  const best = combos[0]!;
  assert.deepEqual([best.feasible, models(best.slots), best.totalScore], [true, ['B', 'R', 'A', 'C', 'D'], 30 + 85 + 80 + 70 + 60], '오케 A 를 고르면 워커 3슬롯 불가');
});

test('후보 부족이면 구성 불가 + 사유', () => {
  const best = buildTeamCombinations({ top15: { orchestrator: [cand('o1', 90)], reviewer: [], worker: [cand('w1', 10)] } })[0]!;
  assert.deepEqual([best.feasible, best.slots.length], [false, 0], '슬롯 없음');
  assert.ok(best.reason?.includes('워커') === true && best.reason?.includes('리뷰어') === true, best.reason ?? '');
  assert.deepEqual([best.unmeasured, best.runnersUp], [0, {}], '구성 불가: 미측정 0·차선 없음');
});

test('동점이라도 결정론적(입력 순서 무관)', () => {
  const a = buildTeamCombinations({ top15: top7(2, 2, 3) }), p2 = top7(2, 2, 3);
  const b = buildTeamCombinations({ top15: { orchestrator: [...p2.orchestrator].reverse(), reviewer: [...p2.reviewer].reverse(), worker: [...p2.worker].reverse() } });
  assert.deepEqual(models(a[0]!.slots), models(b[0]!.slots));
  assert.equal(a[0]!.totalScore, b[0]!.totalScore);
});

test('open 조합은 오픈 웨이트 풀의 base id 만 쓴다', () => {
  const few = { o: [cand('o1', 90)], r: [], w: [cand('w1', 70)] };
  const combos = buildTeamCombinations({ top15: top7(2, 2, 3), unionPool: few });
  assert.equal(combos[2]!.feasible, false, '검증된 모델이 부족 → 구성 불가');
  assert.ok(combos[2]!.reason, '사유 표시');
  const pool = top7(2, 2, 3), enough = buildTeamCombinations({ top15: pool, unionPool: { o: pool.orchestrator, r: pool.reviewer, w: pool.worker } });
  assert.equal(enough[2]!.feasible, true);
  assert.equal(enough[2]!.slots.length, 5);
});

test('registry 는 검증된 8개만 담고 브랜드 일괄 판정을 하지 않는다', () => {
  const keys = loadOpenWeightKeys();
  assert.deepEqual([...keys].sort(), ['deepseek-v4-1-flash', 'glm-5-3', 'glm-5-3-flash', 'kimi-k3', 'mimo-v2-6-flash', 'mimo-v2-6-pro', 'minimax-m3-1-flash', 'muse-spark-1-3']);
  for (const excluded of ['gemini-3-8-flash', 'gpt-6-luna', 'claude-opus-5-5', 'grok-4-7'])
    assert.ok(!keys.has(excluded), `${excluded} 는 검증 근거 없음 — 제외`);
});

test('Top15 후보를 쓴다: 7명 초과 풀이 들어간다', () => {
  const many = Array.from({ length: 16 }, (_, i) => cand(`m${i + 1}`, 100 - i));
  const combos = buildTeamCombinations({ top15: { orchestrator: many.slice(0, 1), reviewer: many.slice(1, 2), worker: many.slice(2) } });
  const best = combos[0]!;
  assert.deepEqual([best.feasible, best.slots.length], [true, 5]);
  assert.equal(best.runnersUp.worker!.modelId, 'm6', '14명 풀에서 차선 계산');
});

test('점수 후보 부족 때만 Free fallback이 워커를 채운다', () => {
  const scored = { orchestrator: [cand('o1', 90)], reviewer: [cand('r1', 80)], worker: [cand('w1', 70)] };
  const free = [{ modelId: 'beam-x', free: true }, { modelId: 'beam-y', free: true }];
  const filled = buildTeamCombinations({ top15: scored, freeWorkerFallback: free })[0]!;
  assert.deepEqual([filled.feasible, filled.slots.filter(s => s.free === true).map(s => s.modelId), filled.slots.every(s => s.score !== undefined || s.free === true)], [true, ['beam-x', 'beam-y'], true], '점수 없음은 free 표시뿐');
  const enough = buildTeamCombinations({ top15: { ...scored, worker: [cand('w1', 70), cand('w2', 60), cand('w3', 50)] }, freeWorkerFallback: free })[0]!;
  assert.ok(enough.slots.every(s => s.free !== true), '점수 후보가 충분하면 fallback 미사용');
});

test('#266: 오픈 풀은 canonical dedupe·O/R 미측정 제외', () => {
  const ids = ['deepseek-v4-1-flash-free', 'minimax-m3-1-flash-free', 'glm-5-3-flash-free', 'mimo-v2-6-flash-free', 'beam-free', 'deepseek-v4-1-flash-free'];
  const lists = { o: [cand('deepseek-v4-1-flash', 62.9), cand('minimax-m3-1-flash', 56)],
    r: [cand('minimax-m3-1-flash', 0.68), cand('deepseek-v4-1-flash', 0.74)], w: [cand('minimax-m3-1-flash', 61.5), cand('mimo-v2-6-flash', 58), cand('glm-5-3-flash', 55)] };
  const pool = unionPool(ids, lists);
  assert.equal(pool.o.filter(c => c.modelId.startsWith('deepseek')).length, 1, 'free/base 중복 제거');
  assert.ok(!pool.o.some(c => c.modelId === 'beam-free') && !pool.r.some(c => c.modelId === 'beam-free'), 'O/R 미측정 Free 제외');
  assert.ok(pool.w.some(c => c.modelId === 'beam-free' && c.score === undefined), 'W Beam fallback');
  const combos = buildTeamCombinations({ top15: { orchestrator: lists.o, reviewer: lists.r, worker: lists.w }, unionPool: pool });
  const free113 = combos.find(c => c.key === 'open-1+1+3')!;
  assert.deepEqual(free113.slots.map(s => s.modelId), ['deepseek-v4-1-flash-free', 'minimax-m3-1-flash-free',
    'mimo-v2-6-flash-free', 'glm-5-3-flash-free', 'beam-free'], 'O deepseek → R minimax → W mimo/glm/beam');
  assert.equal(free113.unmeasured, 1, 'Beam 은 미측정');
});
