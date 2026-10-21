import assert from 'node:assert/strict';
import test from 'node:test';
import { renderThreeRoleMarkdown, renderThreeRoleSection, type ThreeRoleEntry } from '../src/insights/letter-three-role-render.js';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';

const entry = (modelId: string, over: Partial<ThreeRoleEntry> = {}): ThreeRoleEntry => ({
  modelId, rank: 1, score: 72.2, effort: 'medium', isPareto: true, ...over });
const lists = (n: number) => Array.from({ length: n }, (_, i) => entry(`model-${i + 1}`, { rank: i + 1, score: 100 - i }));

test('세 역할 섹션이 각각 그려진다', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: lists(2), reviewer: lists(1), worker: lists(3), depth: 7 });
  for (const heading of ['🧭 오케스트레이터', '🔍 리뷰어', '🛠️ 워커']) assert.ok(md.includes(heading), heading);
  assert.ok(md.includes('## 📖 표시 안내'), '범례');
  assert.equal((md.match(/\| 순위 \| 파레토 \| 모델 \| 스코어 \| effort \|/g) ?? []).length, 3, '역할별 5열 표 머리 3개');
});

test('Top7과 Top15의 행 수가 depth를 따른다', () => {
  const top7 = renderThreeRoleMarkdown({ orchestrator: lists(20), depth: 7 });
  const top15 = renderThreeRoleMarkdown({ orchestrator: lists(20), depth: 15 });
  assert.ok(top7.includes('Top7') && top15.includes('Top15'));
  const rows = (md: string) => (md.match(/^\| \d+ \|/gm) ?? []).length;
  assert.equal(rows(top7), 7);
  assert.equal(rows(top15), 15);
  assert.equal(rows(renderThreeRoleMarkdown({ orchestrator: lists(20) })), 7, '기본 depth는 7');
});

test('빈 목록과 짧은 목록을 다룬다', () => {
  const empty = renderThreeRoleMarkdown({});
  assert.ok(empty.includes('- (목록 없음)'));
  const short = renderThreeRoleMarkdown({ worker: lists(2), depth: 15 });
  assert.equal((short.match(/^\| \d+ \|/gm) ?? []).length, 2);
  assert.equal(renderThreeRoleSection('reviewer', [], 7).includes('Top7'), true);
});

test('선택 필드가 없어도 "-" 로 그린다(가중치·점수를 지어내지 않는다)', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: [{ modelId: 'plain-model' }] });
  assert.ok(md.includes('| 1 |  | plain-model | - | - |'), md);
  assert.ok(!/\d+\.\d/.test(md.split('## 📖')[0]!.split('plain-model')[1]!.split('|')[1] ?? ''), '|score 를 만들지 않는다');
});

test('제어문자와 자격정보 표기를 제거한다', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: [entry('bad\u001b[31m-name\u0000', { effort: 'api_key=sk-abcdefgh1234' })] });
  assert.ok(!md.includes('\u001b'), 'ANSI 제거');
  assert.ok(!md.includes('\u0000'), '제어문자 제거');
  assert.ok(!md.includes('sk-abcdefgh1234'), '자격정보 마스킹');
  assert.ok(md.includes('[redacted]'));
});

test('같은 입력은 같은 출력을 낸다', () => {
  const input = { orchestrator: lists(5), reviewer: lists(2), worker: lists(3), depth: 15 };
  assert.equal(renderThreeRoleMarkdown(input), renderThreeRoleMarkdown(input));
});

test('기존 레터 출력은 바뀌지 않는다(기본 꺼짐)', () => {
  const existing = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-20', records: [] });
  assert.ok(!existing.includes('🔍 리뷰어'), '세역할 리뷰어 섹션이 섞이지 않는다');
  assert.ok(!existing.includes('3역할 리포트'));
  assert.ok(existing.includes('오케스트레이터·리뷰어'), '기존 역할 표기는 그대로다');
});

test('메신저가 네 번째 독립 섹션으로 그려진다(순서·라벨·depth)', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: lists(1), reviewer: lists(1), worker: lists(1),
    messenger: lists(2), depth: 7 });
  const at = (h: string) => md.indexOf(h);
  assert.ok(at('🧭 오케스트레이터') < at('🔍 리뷰어') && at('🔍 리뷰어') < at('🛠️ 워커') && at('🛠️ 워커') < at('✉️ 메신저'), 'o→r→w→m 순서');
  assert.ok(md.includes('## ✉️ 메신저 Top7'));
  assert.equal((md.match(/\| 순위 \| 파레토 \| 모델 \| 스코어 \| effort \|/g) ?? []).length, 4, '4개 표 머리');
});

test('메신저가 비면 섹션을 생략하고 기존 3섹션 출력은 그대로다', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: lists(2), reviewer: lists(1), worker: lists(3), depth: 7 });
  assert.ok(!md.includes('✉️ 메신저'), '빈 메신저 생략');
  assert.equal((md.match(/\| 순위 \| 파레토 \| 모델 \| 스코어 \| effort \|/g) ?? []).length, 3);
  assert.ok(md.includes('- (목록 없음)') === false, '세 역할이 다 있으면 빈 줄 없음');
  assert.ok(renderThreeRoleMarkdown({}).includes('- (목록 없음)'), 'o/r/w 빈 목록 표시는 유지');
});

test('메신저가 있을 때 본문에 워커·메신저 제목이 남지 않는다', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: lists(1), reviewer: lists(1), worker: lists(1),
    messenger: lists(1), depth: 7 });
  assert.ok(md.includes('## 🛠️ 워커 Top7'), '워커 라벨 분리');
  assert.ok(md.includes('## ✉️ 메신저 Top7'));
  assert.ok(!md.includes('워커·메신저'), '구 제목 잔재 없음');
});
