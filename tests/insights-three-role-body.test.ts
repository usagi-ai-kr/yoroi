import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLegacyRoleBlocks, replaceLegacyRoleBlocks } from '../src/insights/letter-three-role-body.js';
import { renderLetterPartsFromRecords } from '../src/insights/letter-markdown.js';

const sections = { orchestrator: '## O', reviewer: '## R', worker: '## W' };
const body = ['# t', '', '## 🧭 오케스트레이터·리뷰어 Top7', '', 'a', '',
  '## 🛠️ 워커 Top7 (실행·코딩·전달)', '', 'b', '', '## 📖 표시 안내', '- 0~100 차원', '- ▽ 하한', '', 'note'].join('\n');

test('역할 블록 교체와 함께 2역할 안내가 3역할 안내로 바뀐다', () => {
  const out = replaceLegacyRoleBlocks(body, sections);
  assert.equal(hasLegacyRoleBlocks(out), false);
  assert.ok(!out.includes('0~100 차원') && !out.includes('▽ 하한'), '낡은 안내 제거');
  assert.ok(out.includes('- 👍 파레토 최적'), '3역할 안내 삽입');
  assert.ok(out.includes('## O') && out.includes('note'), '섹션 교체 + 뒤 내용 보존');
});

test('3역할 섹션의 usagi 각주(Free id 포함)는 교체 후에도 그대로 남는다', () => {
  const withFootnote = { orchestrator: '## O\n\n> deepseek-v4-1-flash: usagi ○ · 문서·계약 검토에 도움.',
    reviewer: '## R', worker: '## W\n\n> minimax-m3-1-flash: usagi △ · 표본이 적어 위험한 단위에는 쓰지 않음.' };
  const out = replaceLegacyRoleBlocks(body, withFootnote);
  assert.ok(out.includes('> deepseek-v4-1-flash: usagi ○ · 문서·계약 검토에 도움.'), '오케 각주 보존');
  assert.ok(out.includes('> minimax-m3-1-flash: usagi △ · 표본이 적어 위험한 단위에는 쓰지 않음.'), '워커 각주 보존');
  assert.ok(!out.includes('0~100 차원'), '2역할 전용 안내는 계속 제거');
});

test('3섹션 교체 순서와 레거시 제거', () => {
  const out3 = replaceLegacyRoleBlocks(body, sections);
  const at = (h: string) => out3.indexOf(h);
  assert.ok(at('## O') < at('## R') && at('## R') < at('## W'), 'o→r→w');
  assert.equal(hasLegacyRoleBlocks(out3), false);
});

const oldBody = ['# t', '', '## 요약', '- 선두: 오케스트레이터·리뷰어 a · 워커 b', '',
  '## 🧭 오케스트레이터·리뷰어 Top7', '', 'a', '',
  '## 🛠️ 워커 Top7 (실행·코딩·전달)', '', 'b', '',
  '## 📖 표시 안내', '- 0~100 차원', '',
  '- 자격: 스코어 ≥ 후보 최고 스코어 × 85%(오케스트레이터·리뷰어)/60%(워커) 통과',
  '- 가중치: 오케·리뷰어 성능 75%·속도 10%·가성비 15% / 워커 성능 30%·사용량 20%·속도 10%·가격 40%', '', 'note'].join('\n');

test('3역할 본문에서 워커 라벨이 유지된다', () => {
  const out = replaceLegacyRoleBlocks(oldBody, sections);
  assert.ok(!/메\s*신\s*저/.test(out), '제거된 역할 문자열 0');
  assert.ok(out.includes('- 선두: 오케스트레이터·리뷰어 a · 워커 b'), '요약 라벨 분리');
  assert.ok(out.includes('워커 성능 30%·사용량 20%·속도 10%·가격 40%'), '워커 가중치 유지');
  assert.ok(out.includes('60%(워커)'), '자격 워커 표기');
});

test('U3c: 레거시 2역할 제목은 유지되고 3역할 섹션과 구분된다', () => {
  const keep = replaceLegacyRoleBlocks('# t\n\n## 🛠️ 워커 Top7 (실행·코딩·전달)\n\nb', sections);
  assert.ok(keep.includes('## 🛠️ 워커 Top7 (실행·코딩·전달)'), '레거시 제목 유지');
  assert.equal(hasLegacyRoleBlocks(keep), true);
  assert.equal(hasLegacyRoleBlocks('## 🛠️ 워커 Top7'), false, '3역할 섹션 제목은 레거시 아님');
});

test('#232: 2역할 레거시 표는 실사용 컬럼 없이 그대로, 3역할 표에는 있다', () => {
  const legacy = renderLetterPartsFromRecords({ publicationDate: '2026-10-21', records: [
    { modelId: 'm1', metric: 'artificial_analysis_intelligence_index', value: 90, priceInput: 1, priceOutput: 2 }] });
  assert.ok(!legacy.body.includes('| effort | 실사용 |'), '2역할 표 머리에는 실사용 컬럼 없음');
  assert.ok(!legacy.comments.some(c => c.includes('| effort | 실사용 |')), '2역할 댓글에도 없음');
  // #242: 제거된 역할 섹션을 정리한 뒤에도 3역할 안내 검증은 동일하다.
  const out = replaceLegacyRoleBlocks(legacy.body, sections);
  assert.ok(out.includes('- 실사용 = usagi 정성 관찰 표식'), '3역할 안내에 실사용 설명');
  assert.ok(!out.includes('| effort | 실사용 |'), '레거시 표 머리에는 실사용 컬럼이 붙지 않음(3역할 표는 별도 렌더)');
});

test('#253: 조합 블록은 워커 섹션 뒤·표시 안내 앞에 삽입된다', () => {
  const out = replaceLegacyRoleBlocks(body, { ...sections, combinations: ['**가장 최선**\n\n```mermaid\nflowchart TB\n```'] });
  const at = (needle: string) => out.indexOf(needle);
  assert.ok(at('## W') < at('## 🧩 권장 조합'), '워커 섹션 뒤');
  assert.ok(at('## 🧩 권장 조합') < at('## 📖 표시 안내'), '표시 안내 앞');
  assert.ok(out.includes('```mermaid'), 'Mermaid 코드 펜스');
});
