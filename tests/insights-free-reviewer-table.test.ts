import assert from 'node:assert/strict';
import test from 'node:test';
import { renderFreeSectionMarkdown } from '../src/insights/letter-markdown-free.js';
import { freeRowsFrom, freeRowOrder, type FreeRow } from '../src/insights/letter-markdown-free-sort.js';
import type { RoleLists } from '../src/insights/letter-top10-unified.js';

const entry = (modelId: string) => ({ modelId, rank: 1, scoreText: '70.0', indexText: '70.0', plans: [] as string[],
  repEffort: 'default', blendedCostText: '-', change: '유지' as const, isPareto: false, both: false });
const lists = (ids: string[]): RoleLists => ({ orchestrator: { entries: ids.map(modelId => entry(modelId)), exits: [] },
  worker: { entries: [], exits: [] } });

test('freeReviewer 없으면 기존 2역할 표 유지', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']), [], 5, undefined);
  assert.ok(lines.some(l => l.includes('| 오케 | 워커 |')), '2역할 머리');
  assert.ok(!lines.some(l => l.includes('리뷰어')), '리뷰어 열 없음');
});

test('freeReviewer [] 이상이면 오케/리뷰어/워커 3역할 표', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']),
    [{ modelId: 'm1', plans: ['p'] }], 5, undefined, [{ modelId: 'm1', score: '81.00', passed: true }]);
  assert.ok(lines.some(l => l.includes('| 오케 | 리뷰어 | 워커 |')), '3역할 머리');
  assert.ok(lines.some(l => l.includes('| m1 |') && l.includes('81.00')), '리뷰어 점수 표시');
});

test('리뷰어 근거 없음은 - 로 유지하고 점수를 만들지 않는다', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']),
    [{ modelId: 'm1', plans: ['p'] }], 5, undefined, [{ modelId: 'm2', score: '0.5', passed: true }]);
  const row = lines.find(l => l.startsWith('| m1 |'))!;
  assert.ok(row.includes('| - |'), '없는 리뷰어 칸은 -');
  assert.ok(!row.includes('0.5'), '다른 모델 점수를 빌려오지 않는다');
});

test('-free 리뷰어 근거는 base형 행에 합쳐진다', () => {
  const lines = renderFreeSectionMarkdown(lists(['glm-5-3-flash']),
    [{ modelId: 'glm-5-3-flash', plans: ['p'] }], 5, undefined, [{ modelId: 'glm-5-3-flash-free', score: '66.00', passed: true }]);
  const row = lines.find(l => l.startsWith('| glm-5-3-flash |'))!;
  assert.ok(row.includes('66.00'), '-free 근거가 base 행에 합쳐진다');
  assert.ok(!lines.some(l => l.startsWith('| glm-5-3-flash-free |')), '별도 행을 만들지 않는다');
});

test('Free 표 각주에 정렬 기준 1줄이 표시된다', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']), [{ modelId: 'm1', plans: ['p'] }], 5, undefined);
  assert.ok(lines.some(l => l.includes('- 정렬: 역할 점수 보유 수↓ → 최고 점수↓ → 모델명')), '정렬 각주');
});

test('jev 접두 모델은 Free 표 행에서 제외된다', () => {
  const L = { orchestrator: { entries: [entry('jev-1-13'), entry('m1')], exits: [] }, worker: { entries: [], exits: [] } };
  const lines = renderFreeSectionMarkdown(L,
    [{ modelId: 'jev-1-13', plans: ['p'] }, { modelId: 'm1', plans: ['p'] }], 5, undefined);
  assert.ok(!lines.some(l => l.startsWith('| jev-1-13 |')), 'jev 행 없음');
  assert.ok(lines.some(l => l.startsWith('| m1 |')), '다른 행 유지');
});

test('정렬: passed 수↓ → 최고 점수↓ → 미측정 아래 → 모델명', () => {
  const e = (modelId: string, score: string) => ({ modelId, rank: 1, scoreText: score, indexText: score, plans: [] as string[],
    repEffort: 'default', blendedCostText: '-', change: '유지' as const, isPareto: false, both: false });
  const L = { orchestrator: { entries: [e('deepseek', '70.0'), e('minimax', '60.0'), e('glm', '66.1'), e('mimo', '59.8')], exits: [] },
    worker: { entries: [e('deepseek', '70.0'), e('minimax', '60.0')], exits: [] } };
  const rows = freeRowsFrom(L, [{ modelId: 'aaa-unmeasured', plans: ['p'] }], Infinity, [{ modelId: 'deepseek', score: '70.00', passed: true }]);
  assert.deepEqual(rows.map(r => r.modelId), ['deepseek', 'minimax', 'glm', 'mimo', 'aaa-unmeasured']);
});

test('동률은 모델명 오름차순, 점수 없는 행은 아래', () => {
  const row = (modelId: string, cells: Partial<FreeRow> = {}): FreeRow =>
    ({ modelId, plans: [], pareto: false, unmeasured: false, ...cells });
  const rows = freeRowOrder([
    row('b', { orchestrator: { score: '60.0', passed: true } }),
    row('a', { orchestrator: { score: '60.0', passed: true } }),
    row('c', { orchestrator: { score: '-', passed: false } })]);
  assert.deepEqual(rows.map(r => r.modelId), ['a', 'b', 'c']);
});

test('80.46/80.54는 표시 그대로·둘 다 파레토·id 순서를 유지한다', () => {
  const e = (modelId: string, scoreText: string) => ({ modelId, rank: 1, scoreText, indexText: '-', plans: [] as string[],
    repEffort: 'default', blendedCostText: '-', change: '유지' as const, isPareto: false, both: false, scoreKey: 80.5 });
  const L = { orchestrator: { entries: [e('m-a', '80.46'), e('m-b', '80.54')], exits: [] }, worker: { entries: [], exits: [] } };
  const rows = freeRowsFrom(L, [], Infinity);
  assert.deepEqual(rows.map(r => [r.modelId, r.orchestrator?.score]), [['m-a', '80.46'], ['m-b', '80.54']]);
  assert.ok(rows.every(r => r.pareto), '1자리 동점이라 둘 다 파레토');
});
