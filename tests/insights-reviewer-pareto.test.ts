import assert from 'node:assert/strict';
import test from 'node:test';
import { isParetoDominated, markReviewerPareto } from '../src/insights/letter-reviewer-pareto.js';

/** #194 C: 리뷰어 파레토 — score 높음 + 실제 비용 낮음 두 축, 정규 price 미사용. */
const c = (modelId: string, score: number, cost: number) => ({ modelId, score, cost });

test('지배: score 가 높고 비용이 낮으면 상대를 지배한다', () => {
  const a = c('a', 90, 3), b = c('b', 80, 5);
  assert.equal(isParetoDominated(b, [a, b]), true, 'score 낮고 비용 높음 → 지배');
  assert.equal(isParetoDominated(a, [a, b]), false, 'score 높고 비용 낮음 → 비지배');
});

test('한 축만 좋고 다른 축이 나쁘면 비지배(부분 지배는 아님)', () => {
  const a = c('a', 90, 9), b = c('b', 80, 3);
  assert.equal(isParetoDominated(a, [a, b]), false, 'score 우위·비용 열위 → 비지배');
  const d = c('d', 70, 1);
  assert.equal(isParetoDominated(a, [a, d]), false, '비용 우위·score 열위 → 비지배');
});

test('동점은 둘 다 비지배', () => {
  const a = c('a', 90, 5), b = c('b', 90, 5);
  assert.equal(isParetoDominated(a, [a, b]), false);
  assert.equal(isParetoDominated(b, [a, b]), false);
});

test('비용 결측은 비파레토(추정하지 않는다)', () => {
  const noCost = { modelId: 'x', score: 90 };
  assert.equal(isParetoDominated(noCost, [noCost, c('y', 80, 1)]), true);
  const marked = markReviewerPareto([noCost, c('y', 80, 1)]);
  assert.equal(marked.find(m => m.modelId === 'x')!.isPareto, false);
  assert.equal(marked.find(m => m.modelId === 'y')!.isPareto, true, '비용 있는 후보는 다른 후보와 비교한다');
});

test('점수 결측도 비파레토', () => {
  const noScore = { modelId: 'x', cost: 1 };
  assert.equal(isParetoDominated(noScore, [noScore, c('y', 80, 1)]), true);
});

test('입력 순서는 결과에 영향을 주지 않는다', () => {
  const list = [c('a', 90, 5), c('b', 80, 3), c('c', 70, 9), c('d', 60, 1)];
  const forward = markReviewerPareto(list).map(m => `${m.modelId}:${m.isPareto}`);
  const backward = markReviewerPareto([...list].reverse()).map(m => `${m.modelId}:${m.isPareto}`);
  assert.deepEqual(forward.slice().sort(), backward.slice().sort());
  const byId = Object.fromEntries(markReviewerPareto(list).map(m => [m.modelId, m.isPareto]));
  // a(90,5)·b(80,3) 는 서로 다른 축 우위 → 둘 다 비지배, c(70,9) 는 b 에 지배, d(60,1) 은 비지배.
  assert.deepEqual(byId, { a: true, b: true, c: false, d: true });
});

test('mark 는 원본 값을 보존한다(점수·비용 변경 없음)', () => {
  const list = [c('a', 90, 5), c('b', 80, 3)];
  const marked = markReviewerPareto(list);
  assert.deepEqual(marked.map(m => [m.modelId, m.score, m.cost]), [['a', 90, 5], ['b', 80, 3]]);
  assert.equal(marked.find(m => m.modelId === 'a')!.isPareto, true);
});
