import assert from 'node:assert/strict';
import test from 'node:test';
import { renderThreeRoleMarkdown, renderThreeRoleSection } from '../src/insights/letter-three-role-render.js';

/** #194: 3역할 표 표시 규칙 — effort 는 plain, 비고에는 내부 미확인 표기 없음, 모델 열은 base id. */
const entry = (over: Record<string, unknown> = {}) => ({ modelId: 'claude-sonnet-5-5-xhigh', rank: 1, score: 73.2,
  effort: 'xhigh', isPareto: false, ...over });

test('모델 열은 base 표시: effort 접미사(-xhigh)가 남지 않는다', () => {
  const section = renderThreeRoleSection('orchestrator', [entry()], 7);
  assert.ok(section.includes('| claude-sonnet-5-5 |'), section);
  assert.ok(!section.includes('claude-sonnet-5-5-xhigh'), 'effort 접미사가 모델 열에 없다');
  assert.ok(section.includes('| xhigh |'), 'effort 열은 plain 값');
});

test('baseModelId가 있으면 그 값을 쓴다', () => {
  const section = renderThreeRoleSection('worker', [entry({ modelId: 'x-high', baseModelId: 'x' })], 7);
  assert.ok(section.includes('| x |'), section);
});

test('비고에 내부 미확인·가중치 미확정 표기를 남기지 않는다', () => {
  const section = renderThreeRoleSection('reviewer', [entry({ unconfirmed: true, weightOpen: true, modelId: 'unknown-model' })], 7);
  assert.ok(!section.includes('미확인') && !section.includes('가중치 미확정'), section);
  assert.ok(section.includes('| - |'), '관찰 없는 모델의 비고는 기본값');
});

test('비고에는 해당 역할의 usagi 정성 노트가 표시된다(점수 아님)', () => {
  const section = renderThreeRoleSection('worker', [entry({ modelId: 'glm-5-3-flash' })], 7);
  assert.ok(section.includes('usagi '), section);
  assert.ok(/◎|○|△/.test(section), '적합성 기호가 보인다');
});

test('3역할 범례에도 미확인·가중치 미확정 문구가 없다', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: [entry()], reviewer: [], worker: [], depth: 7 });
  assert.ok(!md.includes('미확인') && !md.includes('가중치 미확정'), md);
  assert.ok(md.includes('파레토 최적'), '남는 범례는 유지');
});
