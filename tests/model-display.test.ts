import assert from 'node:assert/strict';
import test from 'node:test';
import { applyModelDisplayRules, canonicalModelId, displayModelId, loadModelDisplayRules } from '../src/insights/model-display.js';
import { unionPool } from '../src/insights/letter-team-runners.js';
import { buildTeamCombinations, loadOpenWeightKeys } from '../src/insights/letter-team-combinations.js';
import { combinationBadges } from '../src/insights/letter-mermaid.js';

/** #260: 표시 전용 모델 id 정규화 — 규칙 순서·다중 접미·미지 id·오류 폴백. */
test('기본 규칙은 -free 와 effort 접미를 제거한다', () => {
  assert.deepEqual([displayModelId('deepseek-v4-1-flash-free'), displayModelId('beam-free'),
    displayModelId('muse-spark-1-3-xhigh'), displayModelId('glm-5-3-flash-free')],
    ['deepseek-v4-1-flash', 'beam', 'muse-spark-1-3', 'glm-5-3-flash']); });

test('여러 접미가 겹쳐도 규칙 순서대로 적용된다', () => {
  const rules = [{ match: '-free$', replace: '' }, { match: '-(minimal|low|medium|high|xhigh|max)$', replace: '' }];
  assert.equal(applyModelDisplayRules('muse-spark-1-3-xhigh-free', rules), 'muse-spark-1-3');
  assert.equal(applyModelDisplayRules('muse-spark-1-3-free-high', rules), 'muse-spark-1-3'); });

test('미지 id 와 접미가 없는 id 는 그대로 둔다', () => {
  assert.deepEqual([displayModelId('unknown-model'), displayModelId('gpt-6-1-sol'), displayModelId('')],
    ['unknown-model', 'gpt-6-1-sol', '']); });

test('규칙을 위→아래 순서로 적용한다', () => {
  const rules = [{ match: 'a', replace: 'b' }, { match: 'b', replace: 'c' }];
  assert.equal(applyModelDisplayRules('a', rules), 'c', '첫 규칙 후 두 번째 규칙이 적용');
});

test('잘못된 정규식·비배열·파일 누락은 예외 없이 raw id 로 폴백한다', () => {
  assert.deepEqual([applyModelDisplayRules('a-b', [{ match: '([', replace: 'x' }]), applyModelDisplayRules('a-b', [{ replace: 'x' }])],
    ['a-b', 'a-b']);
  assert.deepEqual(loadModelDisplayRules('/no/such/model-display.json'), []);
  assert.equal(applyModelDisplayRules('keep-me', loadModelDisplayRules('/no/such/model-display.json')), 'keep-me'); });

test('내부 id 는 바뀌지 않는다(표시 전용)', () => {
  const id = 'deepseek-v4-1-flash-free';
  assert.equal(displayModelId(id), 'deepseek-v4-1-flash');
  assert.equal(id, 'deepseek-v4-1-flash-free', '입력 문자열은 불변'); });

/** #266: 오픈 웨이트 레지스트리 id 와 역할 목록 id(AA base) 를 canonical id 로 매칭한다. */
const cand = (modelId: string, score: number) => ({ modelId, baseModelId: modelId, identityKey: modelId, score });
const OPEN_IDS = ['deepseek-v4-1-flash', 'glm-5-3-flash', 'glm-5-3', 'mimo-v2-6-pro', 'mimo-v2-6-flash', 'kimi-k3',
  'muse-spark-1-3', 'minimax-m3-1-flash'];

test('오픈 웨이트 id 는 canonical 로 매칭되고 유료 오픈 모델도 후보가 된다', () => {
  const pool = unionPool(OPEN_IDS, { o: [cand('deepseek-v4-1-flash', 62.9), cand('kimi-k3', 50)],
    r: [cand('minimax-m3-1-flash', 0.68)], w: [cand('mimo-v2-6-flash', 58)] });
  assert.equal(pool.o.find(c => c.modelId === 'deepseek-v4-1-flash')!.score, 62.9, '측정 점수 매칭');
  assert.ok(pool.o.some(c => c.modelId === 'kimi-k3'), '유료 오픈 Kimi K3 도 후보');
  assert.ok(pool.w.some(c => c.modelId === 'muse-spark-1-3' && c.score === undefined), '미측정 오픈은 워커 슬롯'); });

/** #266 회귀: 오픈 조합의 canonical 실체 중복 금지 + 미측정 후보는 워커 슬롯 전용. */
const LISTS = { o: [cand('deepseek-v4-1-flash', 62.9), cand('minimax-m3-1-flash', 56)],
  r: [cand('minimax-m3-1-flash', 0.68), cand('deepseek-v4-1-flash', 0.74)],
  w: [cand('minimax-m3-1-flash', 61.5), cand('mimo-v2-6-flash', 58), cand('glm-5-3-flash', 55)] };

test('#266 회귀: 오픈 1+1+3·1+2 조합에 같은 canonical 실체가 중복 등장하지 않는다', () => {
  const pool = unionPool(OPEN_IDS, LISTS);
  const combos = buildTeamCombinations({ top15: { orchestrator: LISTS.o, reviewer: LISTS.r, worker: LISTS.w }, unionPool: pool });
  for (const key of ['open-1+1+3', 'open-1+2']) {
    const combo = combos.find(c => c.key === key)!;
    assert.equal(combo.feasible, true, `${key} 구성 가능`);
    const canonicals = combo.slots.map(s => canonicalModelId(s.modelId));
    assert.equal(new Set(canonicals).size, canonicals.length, `${key}: canonical 실체 중복 없음`);
  }
});

test('#266 회귀: 미측정 후보는 오케·리뷰어 풀에 없고 워커 슬롯에만 존재한다', () => {
  const pool = unionPool(OPEN_IDS, LISTS);
  assert.ok(!pool.o.some(c => c.score === undefined) && !pool.r.some(c => c.score === undefined), 'O/R 미측정 제외');
  const combos = buildTeamCombinations({ top15: { orchestrator: LISTS.o, reviewer: LISTS.r, worker: LISTS.w }, unionPool: pool });
  const open113 = combos.find(c => c.key === 'open-1+1+3')!;
  assert.ok(!open113.slots.some(s => s.role !== 'worker' && s.score === undefined), 'O/R 슬롯은 모두 측정');
});

test('#266 민감도: identityKey 누락이 있으면 open-1+2 가 구성 가능해져 이 회귀가 실패한다', () => {
  const ids = ['deepseek-v4-1-flash', 'mimo-v2-6-flash'];
  const lists = { o: [cand('deepseek-v4-1-flash', 62.9)], r: [cand('mimo-v2-6-flash', 0.7)], w: [cand('mimo-v2-6-flash', 58)] };
  const pool = unionPool(ids, lists);
  const combos = buildTeamCombinations({ top15: { orchestrator: lists.o, reviewer: lists.r, worker: lists.w }, unionPool: pool });
  const open12 = combos.find(c => c.key === 'open-1+2')!;
  assert.deepEqual([open12.feasible, open12.slots.length], [false, 0], '후보 부족 → 구성 불가(identityKey 누락 시 실패)');
  assert.ok(open12.reason, '부족 사유 표시'); });

/** #266: 두 번째 정책 = 오픈 웨이트 ∪ verified Free(Beam 포함) 합집합. */
const FREE_IDS = ['beam-free', 'minimax-m3-1-flash-free', 'deepseek-v4-1-flash-free', 'glm-5-3-flash-free', 'mimo-v2-6-flash-free'];

test('오픈 웨이트 ∪ Free 합집합 조합: 합산 최적·Kimi 허용·Beam 포함·라벨/뱃지', () => {
  const o = [cand('deepseek-v4-1-flash', 62.9), cand('kimi-k3', 50), cand('minimax-m3-1-flash', 56)];
  const r = [cand('minimax-m3-1-flash', 0.68), cand('deepseek-v4-1-flash', 0.74), cand('kimi-k3', 0.6)];
  const w = [cand('mimo-v2-6-flash', 58), cand('glm-5-3-flash', 55), cand('minimax-m3-1-flash', 61.5)];
  const unionIds = [...new Set([...loadOpenWeightKeys(), ...FREE_IDS])];
  const pool = unionPool(unionIds, { o, r, w });
  const combos = buildTeamCombinations({ top15: { orchestrator: o, reviewer: r, worker: w }, unionPool: pool });
  const open113 = combos.find(c => c.key === 'open-1+1+3')!, open12 = combos.find(c => c.key === 'open-1+2')!;
  assert.equal(open113.slots[0]!.modelId, 'deepseek-v4-1-flash', '합산 최적 결과(역할 우선순위 강제 없음)');
  assert.ok(open113.slots.some(s => s.modelId === 'kimi-k3'), '유료 오픈 Kimi K3 허용');
  assert.ok(open113.label.includes('오픈 웨이트·Free') && combinationBadges(open113).includes('오픈_웨이트·Free'), '라벨·뱃지');
  assert.ok(!open12.slots.some(s => s.role === 'reviewer'), '1+2 는 리뷰어 없음');
  assert.ok(pool.w.some(c => c.modelId === 'beam-free'), 'Beam(Free) 포함'); });
