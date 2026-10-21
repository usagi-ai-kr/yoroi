import assert from 'node:assert/strict';
import test from 'node:test';
import { renderFreeSectionMarkdown } from '../src/insights/letter-markdown-free.js';
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

test('freeMessenger 있으면 오케/리뷰어/워커/메신저 4역할 표', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']),
    [{ modelId: 'm1', plans: ['p'] }], 5, undefined,
    [{ modelId: 'm1', score: '81.00', passed: true }], [{ modelId: 'm1', score: '70.00', passed: true }]);
  assert.ok(lines.some(l => l.includes('| 오케 | 리뷰어 | 워커 | 메신저 |')), '4역할 머리');
  const row = lines.find(l => l.startsWith('| m1 |'))!;
  assert.ok(row.includes('81.00') && row.includes('70.00'), '리뷰어·메신저 점수 표시');
});

test('메신저 근거 없음은 - 이고 빈 배열도 4역할 표 계약이다', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']),
    [{ modelId: 'm1', plans: ['p'] }], 5, undefined,
    [{ modelId: 'm1', score: '81.00', passed: true }], [{ modelId: 'm2', score: '0.5', passed: true }]);
  const row = lines.find(l => l.startsWith('| m1 |'))!;
  assert.ok(row.includes('| - |'), '없는 메신저 칸은 -');
  assert.ok(!row.includes('0.5'), '다른 모델 점수를 빌려오지 않는다');
  const empty = renderFreeSectionMarkdown(lists(['m1']), [{ modelId: 'm1', plans: ['p'] }], 5, undefined, undefined, []);
  assert.ok(empty.some(l => l.includes('| 오케 | 리뷰어 | 워커 | 메신저 |')), '명시적 []도 4역할 표');
});

test('Free 표 각주에 정렬 기준 1줄이 표시된다', () => {
  const lines = renderFreeSectionMarkdown(lists(['m1']), [{ modelId: 'm1', plans: ['p'] }], 5, undefined);
  assert.ok(lines.some(l => l.includes('- 정렬: 오케 통과 → 워커 통과 → 메신저 통과 → 나머지')), '정렬 각주');
});

test('jev 접두 모델은 Free 표 행에서 제외된다', () => {
  const L = { orchestrator: { entries: [entry('jev-1-13'), entry('m1')], exits: [] }, worker: { entries: [], exits: [] } };
  const lines = renderFreeSectionMarkdown(L,
    [{ modelId: 'jev-1-13', plans: ['p'] }, { modelId: 'm1', plans: ['p'] }], 5, undefined);
  assert.ok(!lines.some(l => l.startsWith('| jev-1-13 |')), 'jev 행 없음');
  assert.ok(lines.some(l => l.startsWith('| m1 |')), '다른 행 유지');
});
