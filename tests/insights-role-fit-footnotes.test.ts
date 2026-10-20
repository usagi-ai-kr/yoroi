import assert from 'node:assert/strict';
import test from 'node:test';
import { renderThreeRoleSection } from '../src/insights/letter-three-role-render.js';

const entry = (modelId: string) => ({ modelId, score: 80 });

test('표 아래에 의견 주석이 모델당 1회·표 순서대로 붙는다', () => {
  const md = renderThreeRoleSection('orchestrator',
    [entry('glm-5-3-flash'), entry('plain-model'), entry('deepseek-v4-1-flash')], 7);
  assert.ok(!md.includes('| 비고'), '비고 열 없음');
  const notes = md.split('\n').filter(l => l.startsWith('> '));
  assert.equal(notes.length, 2, '의견 있는 모델만');
  assert.ok(notes[0]!.startsWith('> glm-5-3-flash: usagi'), '형식 + 표 순서');
  assert.ok(notes[1]!.startsWith('> deepseek-v4-1-flash: usagi'));
  assert.ok(md.indexOf(notes[0]!) > md.indexOf('| 3 |'), '주석은 표 아래');
});

test('의견 없는 모델은 주석이 생략된다', () => {
  const md = renderThreeRoleSection('worker', [entry('plain-model')], 7);
  assert.ok(!md.split('\n').some(l => l.startsWith('> ')), '주석 없음');
});
