import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTeamCombinations, loadOpenWeightKeys } from '../src/insights/letter-team-combinations.js';

/** #253: 권장 조합 — 슬롯 구성·조합 내 유일성·합산 최적·부족 후보·동점·오픈 필터. */
const cand = (modelId: string, score: number, effort = 'default') =>
  ({ modelId, baseModelId: modelId, identityKey: modelId, score, effort });
const top7 = (o: number, r: number, w: number) => ({
  orchestrator: Array.from({ length: o }, (_, i) => cand(`o${i + 1}`, 90 - i)),
  reviewer: Array.from({ length: r }, (_, i) => cand(`r${i + 1}`, 85 - i)),
  worker: Array.from({ length: w }, (_, i) => cand(`w${i + 1}`, 80 - i)) });
const models = (slots: readonly { modelId: string }[]) => slots.map(s => s.modelId);

test('4조합이 나오고 슬롯 수가 1+1+3(5)·1+2(3) 이다', () => {
  const combos = buildTeamCombinations({ top7: top7(2, 2, 3) });
  assert.equal(combos.length, 4);
  assert.deepEqual(combos.map(c => c.key), ['best-1+1+3', 'best-1+2', 'open-1+1+3', 'open-1+2']);
  assert.equal(combos[0]!.slots.length, 5);
  assert.equal(combos[1]!.slots.length, 3);
  assert.deepEqual(combos[1]!.slots.map(s => s.role), ['orchestrator', 'worker', 'worker'], '1+2 는 리뷰어 슬롯 없음');
  assert.equal(combos[0]!.feasible && combos[1]!.feasible, true);
});

test('조합 안에서 동일 identityKey 는 1회만(다른 역할 슬롯 사이)', () => {
  const shared = cand('shared', 90);
  const combos = buildTeamCombinations({ top7: {
    orchestrator: [shared, cand('o2', 40)], reviewer: [shared, cand('r2', 39)],
    worker: [cand('w1', 30), cand('w2', 29), cand('w3', 28)] } });
  const keys = combos[0]!.slots.map(s => s.modelId);
  assert.equal(new Set(keys).size, keys.length, '조합 내 중복 없음');
});

test('합산 점수 최대 — 그리디로 먼저 고르면 조합이 막히는 경우를 찾는다', () => {
  const a = cand('A', 90), b = cand('B', 30);
  const combos = buildTeamCombinations({ top7: {
    orchestrator: [a, b], reviewer: [cand('R', 85)],
    worker: [cand('A', 80), cand('C', 70), cand('D', 60)] } });
  const best = combos[0]!;
  assert.equal(best.feasible, true);
  assert.deepEqual(models(best.slots), ['B', 'R', 'A', 'C', 'D'], '오케 A 를 고르면 워커 3슬롯 불가 → B + R + A/C/D');
  assert.equal(best.totalScore, 30 + 85 + 80 + 70 + 60);
});

test('후보 부족이면 구성 불가 + 사유(가짜 모델 없음)', () => {
  const combos = buildTeamCombinations({ top7: { orchestrator: [cand('o1', 90)], reviewer: [], worker: [cand('w1', 10)] } });
  const best = combos[0]!;
  assert.equal(best.feasible, false);
  assert.equal(best.slots.length, 0, '슬롯 없음');
  assert.ok(best.reason?.includes('워커') === true, best.reason ?? '');
  assert.ok(best.reason?.includes('리뷰어') === true, best.reason ?? '');
});

test('동점이라도 결정론적(입력 순서 무관)', () => {
  const a = buildTeamCombinations({ top7: top7(2, 2, 3) });
  const b = buildTeamCombinations({ top7: { orchestrator: [...top7(2, 2, 3).orchestrator].reverse(),
    reviewer: [...top7(2, 2, 3).reviewer].reverse(), worker: [...top7(2, 2, 3).worker].reverse() } });
  assert.deepEqual(models(a[0]!.slots), models(b[0]!.slots));
  assert.equal(a[0]!.totalScore, b[0]!.totalScore);
});

test('오픈 웨이트 조합은 검증 registry 의 base id 만 쓴다', () => {
  const combos = buildTeamCombinations({ top7: top7(2, 2, 3), openWeightKeys: new Set(['o1', 'w1']) });
  assert.equal(combos[2]!.feasible, false, '검증된 모델이 부족 → 구성 불가');
  assert.ok(combos[2]!.reason, '사유 표시');
  const enough = buildTeamCombinations({ top7: top7(2, 2, 3), openWeightKeys: new Set(['o1', 'o2', 'r1', 'r2', 'w1', 'w2', 'w3']) });
  assert.equal(enough[2]!.feasible, true);
  assert.equal(enough[2]!.slots.length, 5);
});

test('registry 는 검증된 6개만 담고 브랜드 일괄 판정을 하지 않는다', () => {
  const keys = loadOpenWeightKeys();
  assert.deepEqual([...keys].sort(), ['deepseek-v4-1-flash', 'glm-5-3', 'glm-5-3-flash', 'kimi-k3', 'mimo-v2-6-flash', 'mimo-v2-6-pro']);
  for (const excluded of ['muse-spark-1-3', 'minimax-m3-1-flash', 'gemini-3-8-flash', 'gpt-6-luna', 'claude-opus-5-5', 'grok-4-7'])
    assert.ok(!keys.has(excluded), `${excluded} 는 검증 근거 없음 — 제외`);
});
