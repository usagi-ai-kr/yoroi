import assert from 'node:assert/strict';
import test from 'node:test';
import { applyModelDisplayRules, canonicalModelId, displayModelId, loadModelDisplayRules } from '../src/insights/model-display.js';
import { freePolicyPool } from '../src/insights/letter-team-runners.js';
import { buildTeamCombinations } from '../src/insights/letter-team-combinations.js';

/** #260: 표시 전용 모델 id 정규화 — 규칙 순서·다중 접미사·미지 id·오류 폴백. */
test('기본 규칙은 -free 와 effort 접미를 제거한다', () => {
  assert.equal(displayModelId('deepseek-v4-1-flash-free'), 'deepseek-v4-1-flash');
  assert.equal(displayModelId('beam-free'), 'beam');
  assert.equal(displayModelId('muse-spark-1-3-xhigh'), 'muse-spark-1-3');
  assert.equal(displayModelId('glm-5-3-flash-free'), 'glm-5-3-flash');
});

test('여러 접미가 겹쳐도 규칙 순서대로 적용된다', () => {
  const rules = [{ match: '-free$', replace: '' }, { match: '-(minimal|low|medium|high|xhigh|max)$', replace: '' }];
  assert.equal(applyModelDisplayRules('muse-spark-1-3-xhigh-free', rules), 'muse-spark-1-3');
  assert.equal(applyModelDisplayRules('muse-spark-1-3-free-high', rules), 'muse-spark-1-3');
});

test('미지 id 와 접미가 없는 id 는 그대로 둔다', () => {
  assert.equal(displayModelId('unknown-model'), 'unknown-model');
  assert.equal(displayModelId('gpt-6-1-sol'), 'gpt-6-1-sol');
  assert.equal(displayModelId(''), '');
});

test('규칙을 위→아래 순서로 적용한다', () => {
  const rules = [{ match: 'a', replace: 'b' }, { match: 'b', replace: 'c' }];
  assert.equal(applyModelDisplayRules('a', rules), 'c', '첫 규칙 후 두 번째 규칙이 적용');
});

test('잘못된 정규식·비배열·파일 누락은 예외 없이 raw id 로 폴백한다', () => {
  assert.equal(applyModelDisplayRules('a-b', [{ match: '([', replace: 'x' }]), 'a-b');
  assert.equal(applyModelDisplayRules('a-b', [{ replace: 'x' }]), 'a-b');
  assert.deepEqual(loadModelDisplayRules('/no/such/model-display.json'), []);
  assert.equal(applyModelDisplayRules('keep-me', loadModelDisplayRules('/no/such/model-display.json')), 'keep-me');
});

test('내부 id 는 바뀌지 않는다(표시 전용)', () => {
  const id = 'deepseek-v4-1-flash-free';
  assert.equal(displayModelId(id), 'deepseek-v4-1-flash');
  assert.equal(id, 'deepseek-v4-1-flash-free', '입력 문자열은 불변');
});

/** #261: Free catalog id(-free) 와 역할 목록 id(AA base) 를 canonical id 로 매칭한다. */
const cand = (modelId: string, score: number) => ({ modelId, baseModelId: modelId, identityKey: modelId, score });
const FREE_CATALOG_IDS = ['deepseek-v4-1-flash-free', 'minimax-m3-1-flash-free', 'glm-5-3-flash-free',
  'mimo-v2-6-flash-free', 'beam-free'];

test('Free catalog id 는 canonical 로 매칭되고 유료 오픈 모델은 빠진다', () => {
  const pool = freePolicyPool(FREE_CATALOG_IDS, { o: [cand('deepseek-v4-1-flash', 62.9), cand('minimax-m3-1-flash', 56)],
    r: [cand('minimax-m3-1-flash', 0.68)], w: [cand('mimo-v2-6-flash', 60)] });
  assert.ok(pool.o.some(c => c.modelId === 'deepseek-v4-1-flash-free'), 'Free catalog id 유지');
  assert.equal(pool.o.find(c => c.modelId === 'deepseek-v4-1-flash-free')!.score, 62.9, '측정 점수 매칭');
  assert.equal(pool.r.find(c => c.modelId === 'minimax-m3-1-flash-free')!.score, 0.68, '리뷰어 점수 매칭');
  assert.ok(pool.w.some(c => c.modelId === 'beam-free' && c.score === undefined), 'Beam 은 미측정');
  for (const paid of ['kimi-k3', 'mimo-v2-6-pro', 'glm-5-3']) assert.ok(!pool.o.some(c => c.modelId === paid), `${paid} 는 Free 조합에서 제외`);
});

/** #261 회귀: Free 조합 canonical 중복 금지 + 미측정 Free 는 워커 fallback 전용. */
const FREE_IDS = ['deepseek-v4-1-flash-free', 'minimax-m3-1-flash-free', 'glm-5-3-flash-free', 'mimo-v2-6-flash-free', 'beam-free', 'deepseek-v4-1-flash-free'];
const LISTS = { o: [cand('deepseek-v4-1-flash', 62.9), cand('minimax-m3-1-flash', 56)],
  r: [cand('minimax-m3-1-flash', 0.68), cand('deepseek-v4-1-flash', 0.74)],
  w: [cand('minimax-m3-1-flash', 61.5), cand('mimo-v2-6-flash', 58), cand('glm-5-3-flash', 55)] };

test('#261 회귀: Free 1+1+3·1+2 조합에 같은 canonical 실체가 중복 등장하지 않는다', () => {
  const pool = freePolicyPool(FREE_IDS, LISTS);
  const combos = buildTeamCombinations({ top15: { orchestrator: LISTS.o, reviewer: LISTS.r, worker: LISTS.w }, freePool: pool });
  for (const key of ['free-1+1+3', 'free-1+2']) {
    const combo = combos.find(c => c.key === key)!;
    assert.equal(combo.feasible, true, `${key} 구성 가능`);
    const canonicals = combo.slots.map(s => canonicalModelId(s.modelId));
    assert.equal(new Set(canonicals).size, canonicals.length, `${key}: canonical 실체 중복 없음`);
    assert.equal(canonicals.filter(k => k === 'deepseek-v4-1-flash').length, 1, 'deepseek 은 1회만');
  }
});

test('#261 회귀: 미측정 Free 는 오케·리뷰어 풀에 없고 워커 fallback 에만 존재한다', () => {
  const pool = freePolicyPool(FREE_IDS, LISTS);
  assert.ok(!pool.o.some(c => c.score === undefined), '오케 풀에 미측정 Free 없음');
  assert.ok(!pool.r.some(c => c.score === undefined), '리뷰어 풀에 미측정 Free 없음');
  assert.ok(pool.w.some(c => c.modelId === 'beam-free' && c.score === undefined), '워커 fallback 에만 미측정 Free');
  const combos = buildTeamCombinations({ top15: { orchestrator: LISTS.o, reviewer: LISTS.r, worker: LISTS.w }, freePool: pool });
  const free113 = combos.find(c => c.key === 'free-1+1+3')!;
  assert.ok(!free113.slots.some(s => s.role !== 'worker' && s.score === undefined), 'O/R 슬롯은 모두 측정');
  assert.equal(free113.unmeasured, 1, '미측정 1건(Beam)만 별도 노출');
});

/** #261 민감도: identityKey 누락 결함을 실제로 잡는지 확인하는 회귀. */
test('#261 민감도: identityKey 누락이 있으면 free-1+2 가 구성 가능해져 이 회귀가 실패한다', () => {
  const ids = ['deepseek-v4-1-flash-free', 'mimo-v2-6-flash-free'];
  const lists = { o: [cand('deepseek-v4-1-flash', 62.9)], r: [cand('mimo-v2-6-flash', 0.7)], w: [cand('mimo-v2-6-flash', 58)] };
  const pool = freePolicyPool(ids, lists);
  const canonicals = pool.w.map(c => canonicalModelId(c.modelId));
  assert.equal(new Set(canonicals).size, canonicals.length, '워커 풀 canonical 중복 없음');
  const combos = buildTeamCombinations({ top15: { orchestrator: lists.o, reviewer: lists.r, worker: lists.w }, freePool: pool });
  const free12 = combos.find(c => c.key === 'free-1+2')!;
  assert.deepEqual([free12.feasible, free12.slots.length], [false, 0], '후보 부족 → 구성 불가(identityKey 누락 시 실패)');
  assert.ok(free12.reason, '부족 사유 표시');
});
