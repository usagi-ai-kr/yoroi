import assert from 'node:assert/strict';
import test from 'node:test';
import { selectThreeRoles, type ThreeRoleAdapterInput } from '../src/insights/letter-three-role.js';
import type { RoleCandidate } from '../src/insights/letter-role-selection.js';

const c = (id: string, open?: boolean, unconfirmed?: boolean): RoleCandidate => ({
  modelId: id,
  ...(open !== undefined ? { weightOpen: open } : {}),
  ...(unconfirmed !== undefined ? { unconfirmed } : {}),
});

test('1. 독립 선발: 입력 순서 유지, top7/top15 슬라이스·접두 일치, 역할 내부 중복 제거', () => {
  const o = Array.from({ length: 20 }, (_, i) => c(`o-${i}`, false));
  const r = Array.from({ length: 20 }, (_, i) => c(`r-${i}`, false));
  const res = selectThreeRoles({ orchestrator: o, reviewer: r, worker: [] });
  assert.equal(res.orchestrator.top7.length, 7);
  assert.equal(res.orchestrator.top15.length, 15);
  assert.deepEqual(res.top15.orchestrator.slice(0, 7).map(x => x.modelId), res.top7.orchestrator.map(x => x.modelId), '댓글 Top15는 본문 Top7 접두');
  assert.deepEqual(res.top7.reviewer.map(x => x.modelId), r.slice(0, 7).map(x => x.modelId));
  const dup = selectThreeRoles({ orchestrator: [c('d', false), c('d', false)], reviewer: [], worker: [] });
  assert.deepEqual(dup.orchestrator.all.map(x => x.modelId), ['d'], '역할 내부는 identityKey 중복 제거');
});

test('2. 같은 클로즈드 모델 A는 오케·리뷰어 양쪽 1위', () => {
  const res = selectThreeRoles({
    orchestrator: [c('A', false), c('c2', false)],
    reviewer: [c('A', false), c('c3', false)],
  });
  assert.deepEqual(res.orchestrator.top7.map(x => x.modelId), ['A', 'c2']);
  assert.deepEqual(res.reviewer.top7.map(x => x.modelId), ['A', 'c3']);
});

test('3. open-weight duplicate allowed across o/r', () => {
  const res = selectThreeRoles({
    orchestrator: [c('open1', true), c('c1', false)],
    reviewer: [c('open1', true), c('c2', false)],
  });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['open1', 'c1']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['open1', 'c2']);
});

test('4. worker independence', () => {
  const res = selectThreeRoles({
    orchestrator: [c('c1', false)], reviewer: [c('c2', false)],
    worker: [c('c1', false), c('c2', false)],
  });
  assert.deepEqual(res.worker.all.map(x => x.modelId), ['c1', 'c2']);
});

test('5. empty/short lists handling', () => {
  const res = selectThreeRoles({ orchestrator: [], reviewer: [c('r1', false)], worker: [] });
  assert.equal(res.orchestrator.all.length, 0);
  assert.equal(res.orchestrator.top7.length, 0);
  assert.equal(res.reviewer.all.length, 1);
  assert.equal(res.reviewer.top7.length, 1);
  assert.equal(res.reviewer.top15.length, 1);
});

test('6. 미확인 모델도 역할 간 공유되고 unconfirmedModels에 남는다', () => {
  const res = selectThreeRoles({
    orchestrator: [c('u1'), c('c2', false)],
    reviewer: [c('u1'), c('c3', false)],
  });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['u1', 'c2']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['u1', 'c3']);
  assert.ok(res.unconfirmedModels.includes('u1'));
});

test('7. classifier function injection', () => {
  const classifier = (id: string) => id === 'm-open' ? true : id === 'm-closed' ? false : undefined;
  const res = selectThreeRoles({
    orchestrator: [c('m-open'), c('m-closed')],
    reviewer: [c('m-open'), c('m-closed')],
    classifier,
  });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['m-open', 'm-closed']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['m-open', 'm-closed']);
});

test('8. 같은 기반 다른 effort/경로는 역할 간 공유, 역할 내 순서 유지', () => {
  const hi = { modelId: 'm-high', baseModelId: 'm' }, lo = { modelId: 'm-low', baseModelId: 'm' };
  const res = selectThreeRoles({ orchestrator: [hi, c('o2', false)], reviewer: [lo, c('r2', false)], worker: [] });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['m-high', 'o2']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['m-low', 'r2']);
  const gen = selectThreeRoles({
    orchestrator: [c('gpt-4o', false), c('gpt-4o-mini', false)],
    reviewer: [c('gpt-4o-mini', false), c('gpt-4o', false)],
  });
  assert.deepEqual(gen.orchestrator.all.map(x => x.modelId), ['gpt-4o', 'gpt-4o-mini']);
  assert.deepEqual(gen.reviewer.all.map(x => x.modelId), ['gpt-4o-mini', 'gpt-4o']);
});

test('9. deterministic repeat', () => {
  const input: ThreeRoleAdapterInput = {
    orchestrator: [c('a', false), c('b', true)],
    reviewer: [c('b', true), c('c', false)], worker: [c('a', false)],
  };
  const r1 = selectThreeRoles(input), r2 = selectThreeRoles(input);
  assert.deepEqual(r1, r2);
});
