import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRolesAlternating, type RoleCandidate } from '../src/insights/letter-role-selection.js';

const c = (id: string, open?: boolean, unconfirmed?: boolean): RoleCandidate => ({
  modelId: id,
  ...(open !== undefined ? { weightOpen: open } : {}),
  ...(unconfirmed !== undefined ? { unconfirmed } : {}),
});

test('같은 클로즈드 모델 A가 오케·리뷰어 양쪽 1위', () => {
  const res = selectRolesAlternating({ orchestrator: [c('A', false)], reviewer: [c('A', false)], worker: [] });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['A']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['A']);
  assert.equal(res.orchestrator[0]!.rank, 1);
  assert.equal(res.reviewer[0]!.rank, 1);
});

test('역할 간 공유·역할 내부 중복 제거', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('s', true), c('s', true), c('o', false)],
    reviewer: [c('s', true), c('u', undefined, true)], worker: [c('s', true)] });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['s', 'o']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['s', 'u']);
  assert.deepEqual(res.worker.map(x => x.modelId), ['s']);
  assert.ok(res.unconfirmedModels.includes('u'));
});

test('depth·빈 목록·순서 결정성', () => {
  const o = Array.from({ length: 20 }, (_, i) => c(`o-${i}`, false));
  const res = selectRolesAlternating({ orchestrator: o, reviewer: [], worker: [], depth: 7 });
  assert.equal(res.orchestrator.length, 7);
  assert.equal(res.depth, 7);
  assert.deepEqual(res.orchestrator.map(x => x.rank), [1, 2, 3, 4, 5, 6, 7]);
  const again = selectRolesAlternating({ orchestrator: o, reviewer: [], worker: [], depth: 7 });
  assert.deepEqual(res, again);
});
