import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTeamCombinations } from '../src/insights/letter-team-combinations.js';
import { canonicalModelId } from '../src/insights/model-display.js';

/** #266-DELTA: 4조합 워커 ≥1 verified Free. 측정 우선·미측정 fallback·나머지 자연 최대. */
const cand = (modelId: string, score?: number, free?: boolean) => ({ modelId, baseModelId: modelId, identityKey: modelId,
  ...(score !== undefined && { score }), ...(free === true && { free }) });
const keys = (ids: readonly string[]): ReadonlySet<string> => new Set(ids.map(canonicalModelId));
const workersOf = (slots: readonly { role: string; modelId: string }[]): string[] =>
  slots.filter(s => s.role === 'worker').map(s => s.modelId);
const FREE = 'mimo-v2-6-flash-free';

test('best-1+1+3: 저점수 측정 Free도 워커 1자리 보장, 나머지는 합산 최대', () => {
  const top = { orchestrator: [cand('a', 90)], reviewer: [cand('b', 80)], worker: [cand('c', 70), cand('d', 60), cand('e', 50), cand('mimo-v2-6-flash', 10)] };
  const [quota] = buildTeamCombinations({ top15: top, verifiedFreeKeys: keys([FREE]) });
  assert.deepEqual(workersOf(quota!.slots).sort(), ['c', 'd', 'mimo-v2-6-flash'].sort(), '저점수 Free 포함');
  assert.equal(quota!.totalScore, 90 + 80 + 70 + 60 + 10, 'O/R + 나머지 W는 자연 최대');
  const [legacy] = buildTeamCombinations({ top15: top });
  assert.ok(!workersOf(legacy!.slots).includes('mimo-v2-6-flash'), '키 없으면 기존 동작 유지');
  assert.equal(legacy!.totalScore, 90 + 80 + 70 + 60 + 50, '레거시 합산 최대');
});

test('best-1+2: 워커 2자리 중 1자리는 Free', () => {
  const top = { orchestrator: [cand('a', 90)], reviewer: [cand('b', 80)], worker: [cand('c', 70), cand('d', 60), cand('mimo-v2-6-flash', 10)] };
  const combos = buildTeamCombinations({ top15: top, verifiedFreeKeys: keys([FREE]) });
  const one2 = combos.find(c => c.key === 'best-1+2')!;
  assert.deepEqual(workersOf(one2.slots).sort(), ['c', 'mimo-v2-6-flash'].sort());
  assert.ok(!one2.slots.some(s => s.role === 'reviewer'), '1+2 리뷰어 없음 유지');
});

test('open-1+1+3·1+2: union 풀에서도 워커 Free 보장', () => {
  const union = { o: [cand('a', 90)], r: [cand('b', 80), cand('g', 75)], w: [cand('c', 70), cand('e', 50), cand('mimo-v2-6-flash', 10)] };
  const top = { orchestrator: union.o, reviewer: union.r, worker: union.w };
  const combos = buildTeamCombinations({ top15: top, unionPool: union, verifiedFreeKeys: keys([FREE]) });
  for (const key of ['open-1+1+3', 'open-1+2'] as const) {
    const combo = combos.find(c => c.key === key)!;
    assert.equal(combo.feasible, true, `${key} 구성 가능`);
    assert.ok(workersOf(combo.slots).includes('mimo-v2-6-flash'), `${key} 워커 Free 포함`);
  }
});

test('측정 Free가 있으면 미측정 Beam은 강제되지 않는다', () => {
  const beam = cand('beam-free', undefined, true);
  const top = { orchestrator: [cand('a', 90)], reviewer: [cand('b', 80)], worker: [cand('c', 70), cand('mimo-v2-6-flash', 60), beam] };
  const [quota] = buildTeamCombinations({ top15: top, freeWorkerFallback: [beam], verifiedFreeKeys: keys([FREE, 'beam-free']) });
  assert.deepEqual(workersOf(quota!.slots).sort(), ['c', 'mimo-v2-6-flash', 'beam-free'].sort());
  assert.equal(quota!.unmeasured, 1, 'Beam은 미측정 1건으로만 별도 노출');
  assert.equal(quota!.slots.find(s => s.modelId === 'beam-free')!.score, undefined, 'Beam 점수 생성 없음');
});

test('미측정뿐이면 fallback으로 1자리 채우고 점수는 만들지 않는다', () => {
  const beam = cand('beam-free', undefined, true);
  const top = { orchestrator: [cand('a', 90)], reviewer: [cand('b', 80)], worker: [cand('c', 70), cand('d', 60)] };
  const [quota] = buildTeamCombinations({ top15: top, freeWorkerFallback: [beam], verifiedFreeKeys: keys(['beam-free']) });
  assert.ok(workersOf(quota!.slots).includes('beam-free'), 'fallback이 1자리 보장');
  assert.equal(quota!.unmeasured, 1);
});

test('Free 후보가 없으면 구성 불가 + 명시 사유', () => {
  const top = { orchestrator: [cand('a', 90)], reviewer: [cand('b', 80)], worker: [cand('c', 70), cand('d', 60), cand('e', 50)] };
  const [quota] = buildTeamCombinations({ top15: top, verifiedFreeKeys: keys(['zzz-free']) });
  assert.equal(quota!.feasible, false);
  assert.ok(quota!.reason?.includes('Free'), `사유 명시: ${quota!.reason}`);
});

test('O 강제 없음: 저점수 DeepSeek이 있어도 O는 합산 최대', () => {
  const top = { orchestrator: [cand('deepseek-v4-1-flash', 50), cand('gpt-6-sol', 90)], reviewer: [cand('b', 80)],
    worker: [cand('c', 70), cand('d', 60), cand('mimo-v2-6-flash', 10)] };
  const [quota] = buildTeamCombinations({ top15: top, verifiedFreeKeys: keys([FREE, 'deepseek-v4-1-flash-free']) });
  assert.equal(quota!.slots.find(s => s.role === 'orchestrator')!.modelId, 'gpt-6-sol', 'O는 자연 최대');
  assert.ok(workersOf(quota!.slots).includes('mimo-v2-6-flash'), '쿼터는 워커에만 적용');
});
