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
    [{ modelId: 'm1', plans: ['p'] }], 5, undefined, [{ modelId: 'm1', score: '0.81', passed: true }]);
  assert.ok(lines.some(l => l.includes('| 오케 | 리뷰어 | 워커 |')), '3역할 머리');
  assert.ok(lines.some(l => l.includes('| m1 |') && l.includes('0.81')), '리뷰어 점수 표시');
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
    [{ modelId: 'glm-5-3-flash', plans: ['p'] }], 5, undefined, [{ modelId: 'glm-5-3-flash-free', score: '0.66', passed: true }]);
  const row = lines.find(l => l.startsWith('| glm-5-3-flash |'))!;
  assert.ok(row.includes('0.66'), '-free 근거가 base 행에 합쳐진다');
  assert.ok(!lines.some(l => l.startsWith('| glm-5-3-flash-free |')), '별도 행을 만들지 않는다');
});
