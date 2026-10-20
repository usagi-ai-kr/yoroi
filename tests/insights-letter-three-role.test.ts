import assert from 'node:assert/strict';
import test from 'node:test';
import { selectThreeRoles, type ThreeRoleAdapterInput } from '../src/insights/letter-three-role.js';
import type { RoleCandidate } from '../src/insights/letter-role-selection.js';

const c = (id: string, open?: boolean, unconfirmed?: boolean): RoleCandidate => ({
  modelId: id,
  ...(open !== undefined ? { weightOpen: open } : {}),
  ...(unconfirmed !== undefined ? { unconfirmed } : {}),
});

test('1. alternating order o1, r1, o2, r2 and top7/top15 slices', () => {
  const o = Array.from({ length: 20 }, (_, i) => c(`o-${i}`, false));
  const r = Array.from({ length: 20 }, (_, i) => c(`r-${i}`, false));
  const res = selectThreeRoles({ orchestrator: o, reviewer: r, worker: [] });
  assert.equal(res.orchestrator.top7.length, 7);
  assert.equal(res.orchestrator.top15.length, 15);
  assert.equal(res.reviewer.top7.length, 7);
  assert.equal(res.reviewer.top15.length, 15);
  assert.deepEqual(res.top7.orchestrator.map(x => x.modelId), o.slice(0, 7).map(x => x.modelId));
  assert.deepEqual(res.top7.reviewer.map(x => x.modelId), r.slice(0, 7).map(x => x.modelId));
});

test('2. closed duplicate exclusion across o/r', () => {
  const res = selectThreeRoles({
    orchestrator: [c('c1', false), c('c2', false)],
    reviewer: [c('c1', false), c('c3', false)],
  });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['c1', 'c2']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['c3']);
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

test('6. unknown classification treated conservatively as closed + unconfirmed', () => {
  const res = selectThreeRoles({
    orchestrator: [c('u1'), c('c2', false)],
    reviewer: [c('u1'), c('c3', false)],
  });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['u1', 'c2']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['c3']);
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
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['m-open']);
});

test('8. distinct generations/variants not merged', () => {
  const res = selectThreeRoles({
    orchestrator: [c('gpt-4o', false), c('gpt-4o-mini', false)],
    reviewer: [c('gpt-4o-mini', false), c('gpt-4o', false)],
  });
  assert.deepEqual(res.orchestrator.all.map(x => x.modelId), ['gpt-4o']);
  assert.deepEqual(res.reviewer.all.map(x => x.modelId), ['gpt-4o-mini']);
});

test('9. deterministic repeat', () => {
  const input: ThreeRoleAdapterInput = {
    orchestrator: [c('a', false), c('b', true)],
    reviewer: [c('b', true), c('c', false)], worker: [c('a', false)],
  };
  const r1 = selectThreeRoles(input), r2 = selectThreeRoles(input);
  assert.deepEqual(r1, r2);
});
