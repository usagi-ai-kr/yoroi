import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRolesAlternating, type RoleCandidate } from '../src/insights/letter-role-selection.js';

const c = (id: string, open?: boolean, unconfirmed?: boolean): RoleCandidate => ({
  modelId: id, ...(open !== undefined ? { weightOpen: open } : {}), ...(unconfirmed !== undefined ? { unconfirmed } : {}),
});

test('1. closed duplicate exclusion across o/r', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('c1', false), c('c2', false)],
    reviewer: [c('c1', false), c('c3', false)], worker: [],
  });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['c1', 'c2']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['c3']);
});

test('2. open-weight duplicate allowed across o/r', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('o1', true), c('c1', false)],
    reviewer: [c('o1', true), c('c2', false)], worker: [],
  });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['o1', 'c1']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['o1', 'c2']);
});

test('3. worker independence from o/r', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('c1', false)], reviewer: [c('c2', false)],
    worker: [c('c1', false), c('c2', false)],
  });
  assert.deepEqual(res.worker.map(x => x.modelId), ['c1', 'c2']);
});

test('4. alternating round-robin order o1, r1, o2, r2', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('a', false), c('b', false), c('c', false)],
    reviewer: [c('b', false), c('a', false), c('d', false)], worker: [],
  });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['a', 'c']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['b', 'd']);
  assert.deepEqual(res.orchestrator.map(x => x.rank), [1, 2]);
  assert.deepEqual(res.orchestrator.map(x => x.originalRank), [1, 3]);
  assert.deepEqual(res.reviewer.map(x => x.originalRank), [1, 3]);
});

test('5. candidate shortage and empty list handling', () => {
  const res = selectRolesAlternating({ orchestrator: [], reviewer: [c('r1', false)], worker: [], depth: 5 });
  assert.equal(res.orchestrator.length, 0);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['r1']);
});

test('6. unknown classification treated conservatively as closed + unconfirmed', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('u1'), c('c2', false)],
    reviewer: [c('u1'), c('c3', false)], worker: [],
  });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['u1', 'c2']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['c3']);
  assert.equal(res.orchestrator[0]?.isClosed, true);
  assert.equal(res.orchestrator[0]?.unconfirmed, true);
  assert.ok(res.unconfirmedModels.includes('u1'));
});

test('7. distinct generations/variants not merged', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('gpt-4o', false), c('gpt-4o-mini', false)],
    reviewer: [c('gpt-4o-mini', false), c('gpt-4o', false)], worker: [],
  });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['gpt-4o']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['gpt-4o-mini']);
});

test('8. deterministic repeat across runs', () => {
  const input = {
    orchestrator: [c('m1', false), c('m2', true), c('m3', false)],
    reviewer: [c('m2', true), c('m1', false), c('m4', false)],
    worker: [c('m1', false)], depth: 3,
  };
  const r1 = selectRolesAlternating(input), r2 = selectRolesAlternating(input);
  assert.deepEqual(r1, r2);
});

test('9. skip candidates with empty resolved identity key', () => {
  const res = selectRolesAlternating({
    orchestrator: [c('   '), c('m1', false)],
    reviewer: [c(''), c('m2', false)],
    worker: [c(' '), c('m3', false)],
  });
  assert.deepEqual(res.orchestrator.map(x => x.modelId), ['m1']);
  assert.deepEqual(res.reviewer.map(x => x.modelId), ['m2']);
  assert.deepEqual(res.worker.map(x => x.modelId), ['m3']);
});
