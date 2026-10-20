import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceLetterGuide, THREE_ROLE_LEGEND } from '../src/insights/letter-three-role-legend.js';

const body = (guide: string[]): string =>
  ['# title', '', '## 🧭 오케스트레이터·리뷰어 Top7', '', 'x', '', ...guide, '', '<details>', '공식', '</details>'].join('\n');

test('2역할 안내만 교체하고 공식·출처는 보존한다', () => {
  const oldGuide = ['## 📖 표시 안내', '- 0~100 차원', '- ▽ 하한 보충', '- +N 가산', '- 🔒 접근 제한'];
  const out = replaceLetterGuide(body(oldGuide));
  assert.ok(!out.includes('0~100') && !out.includes('▽') && !out.includes('+N') && !out.includes('🔒'), '미사용 항목 제거');
  assert.ok(out.includes('- 👍 파레토 최적'), '실제 표시 항목 유지');
  assert.ok(out.includes('<details>') && out.includes('공식'), '산출 공식·출처 보존');
  assert.ok(out.includes('usagi = ') && out.includes('(점수 아님)'), '정성 출처·점수 아님 유지');
});

test('안내가 없으면 그대로 둔다', () => {
  const text = ['# title', '', '본문'].join('\n');
  assert.equal(replaceLetterGuide(text), text);
});

test('standalone 안내와 같은 출처를 쓴다', () => {
  assert.deepEqual(THREE_ROLE_LEGEND.slice(0, 3), ['## 📖 표시 안내', '- 👍 파레토 최적',
    '- 스코어·effort 는 표시된 값 그대로(effort=추천 추론 강도, -=근거 없음)']);
});
