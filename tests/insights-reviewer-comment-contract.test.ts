import assert from 'node:assert/strict';
import test from 'node:test';
import { composeThreeRoleComments } from '../src/composition/insights-cli.js';
import { buildThreeRole } from '../src/composition/insights-three-role.js';
import type { LetterParts } from '../src/insights/letter-parts.js';
import type { ThreeRoleSelectionOutput } from '../src/insights/letter-three-role.js';
import type { ThreeRolePipelineOutput } from '../src/insights/letter-three-role-pipeline.js';

/** #195 댓글 계약(리뷰 F2): opt-in [o15, r15, w15+Free] · 기본 off 동일 · 리뷰어 비면 사유만. */
const cand = (modelId: string, score: number) => ({ modelId, score, effort: 'default',
  rank: 1, originalRank: 1, identityKey: modelId, isClosed: false, unconfirmed: false, weightOpen: false });
const slices = (items: ReturnType<typeof cand>[]) => ({ top7: items.slice(0, 7), top15: items.slice(0, 15), all: items });
const selection = (reviewer: ReturnType<typeof cand>[]): ThreeRoleSelectionOutput => ({
  orchestrator: slices([cand('o1', 90)]), reviewer: slices(reviewer), worker: slices([cand('w1', 85)]),
  top7: { orchestrator: [], reviewer: [], worker: [] },
  top15: { orchestrator: [cand('o1', 90)], reviewer, worker: [cand('w1', 85)] }, unconfirmedModels: [] });
const parts = (): LetterParts => ({ body: 'b', comments: ['C1', 'C2', 'FREE'] });

test('#195 댓글 계약: opt-in 은 같은 selection에서 [o15, r15, w15+Free]', () => {
  const threeRole: ThreeRolePipelineOutput = { enabled: true, selection: selection([cand('r1', 80)]) };
  const comments = composeThreeRoleComments(parts(), threeRole);
  assert.equal(comments.length, 3, '댓글 3개 계약');
  assert.ok(comments[0].includes('o1') && comments[0].includes('Top15'), 'c1 오케 Top15');
  assert.ok(comments[1].includes('r1') && comments[1].includes('Top15'), 'c2 리뷰어 Top15');
  assert.ok(comments[2].includes('w1') && comments[2].endsWith('FREE'), 'c3 워커 Top15 + Free 원문');
});

test('#195 댓글 계약: 기본 off(selection 없음)는 댓글을 그대로 둔다', () => {
  const p = parts();
  assert.equal(composeThreeRoleComments(p, { enabled: false }), p.comments, '기본 off는 댓글 원본 그대로');
});

test('#195 댓글 계약: 리뷰어가 비면 사유만 있고 모델명은 만들지 않는다', () => {
  const threeRole: ThreeRolePipelineOutput = { enabled: true, emptyCause: 'no candidates', selection: selection([]) };
  const comments = composeThreeRoleComments(parts(), threeRole);
  assert.ok(comments[1].includes('(목록 없음)') && comments[1].includes('no candidates'), '사유를 함께 보여준다');
  assert.ok(!comments[1].includes('r1'), '리뷰어 모델명을 지어내지 않는다');
});

test('#195 리뷰 F3: 명시적 reviewer 경로도 리뷰어가 비면 사유를 남긴다', () => {
  const none = buildThreeRole({ reviewer: [], orchestrator: [{ modelId: 'o1', score: 90 }], options: { enabled: true } });
  assert.equal(none?.selection?.reviewer.all.length, 0);
  assert.ok(none?.emptyCause, '명시 reviewer 비면 사유가 남는다');
  // 교대 배정(MECE)로 오케가 이미 집은 모델만 리뷰어 후보면 목록이 빈다 → 역시 사유를 남긴다.
  const taken = buildThreeRole({ reviewer: [{ modelId: 'shared', score: 80 }],
    orchestrator: [{ modelId: 'shared', score: 90 }], options: { enabled: true } });
  assert.equal(taken?.selection?.reviewer.all.length, 0, '교대 배정 후 리뷰어 목록이 빈다');
  assert.ok(taken?.emptyCause, 'MECE 배정 후 비어도 사유가 남는다');
});

/** U3b: 메신저가 있으면 4댓글(o15/r15/w15/m15+Free), 없으면 기존 3댓글로 폴백한다. */
const withMessenger = (reviewer: ReturnType<typeof cand>[], messenger: ReturnType<typeof cand>[]): ThreeRoleSelectionOutput => ({
  orchestrator: slices([cand('o1', 90)]), reviewer: slices(reviewer), worker: slices([cand('w1', 85)]),
  messenger: slices(messenger),
  top7: { orchestrator: [], reviewer: [], worker: [] },
  top15: { orchestrator: [cand('o1', 90)], reviewer, worker: [cand('w1', 85)], messenger },
  unconfirmedModels: [] });
const freeParts = (): LetterParts => ({ body: 'b', comments: ['C1', 'C2', 'FREE'], freeSection: 'FREE' });

test('U3b: 메신저가 있으면 4댓글(o15/r15/w15/m15+Free) 순서로 조립된다', () => {
  const threeRole: ThreeRolePipelineOutput = { enabled: true, selection: withMessenger([cand('r1', 80)], [cand('m1', 70)]) };
  const comments = composeThreeRoleComments(freeParts(), threeRole);
  assert.equal(comments.length, 4, '댓글 4개');
  assert.ok(comments[0]!.includes('o1') && comments[1]!.includes('r1'), 'c1 오케 · c2 리뷰어');
  assert.ok(comments[2]!.includes('w1') && !comments[2]!.includes('FREE'), 'c3 워커만(Free 는 마지막 댓글)');
  assert.ok(comments[3]!.includes('m1') && comments[3]!.endsWith('FREE'), 'c4 메신저 + Free');
});

test('U3b: 4역할 댓글 제목이 워커·메신저로 분리되고 워커·메신저 제목이 남지 않는다', () => {
  const threeRole: ThreeRolePipelineOutput = { enabled: true, selection: withMessenger([cand('r1', 80)], [cand('m1', 70)]) };
  const comments = composeThreeRoleComments(freeParts(), threeRole);
  assert.ok(comments[2]!.includes('🛠️ 워커 Top15'), '워커 제목');
  assert.ok(comments[3]!.includes('✉️ 메신저 Top15'), '메신저 제목');
  assert.ok(!comments.some(c => c.includes('워커·메신저')), '워커·메신저 합성 제목 없음');
});

test('U3b: 메신저가 없으면 기존 3댓글(o15/r15/w15+Free)로 폴백한다', () => {
  const threeRole: ThreeRolePipelineOutput = { enabled: true, selection: withMessenger([cand('r1', 80)], []) };
  const comments = composeThreeRoleComments(freeParts(), threeRole);
  assert.equal(comments.length, 3, '댓글 3개 폴백');
  assert.ok(comments[2]!.includes('w1') && comments[2]!.endsWith('FREE'), 'c3 워커 Top15 + Free 원문');
});
