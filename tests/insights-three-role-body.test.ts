import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyRoleBlocks, replaceLegacyRoleBlocks } from '../src/insights/letter-three-role-body.js';

const sections = { orchestrator: '## O', reviewer: '## R', worker: '## W' };
const body = ['# t', '', '## 🧭 오케스트레이터·리뷰어 Top7', '', 'a', '',
  '## 🛠️ 워커·메신저 Top7', '', 'b', '', '## 📖 표시 안내', '- 0~100 차원', '- ▽ 하한', '', 'note'].join('\n');

test('역할 블록 교체와 함께 2역할 안내가 3역할 안내로 바뀐다', () => {
  const out = replaceLegacyRoleBlocks(body, sections);
  assert.equal(hasLegacyRoleBlocks(out), false);
  assert.ok(!out.includes('0~100 차원') && !out.includes('▽ 하한'), '낡은 안내 제거');
  assert.ok(out.includes('- 👍 파레토 최적'), '3역할 안내 삽입');
  assert.ok(out.includes('## O') && out.includes('note'), '섹션 교체 + 뒤 내용 보존');
});
