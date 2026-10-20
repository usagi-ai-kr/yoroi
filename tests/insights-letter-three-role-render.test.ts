import assert from 'node:assert/strict';
import test from 'node:test';
import { renderThreeRoleMarkdown, renderThreeRoleSection, type ThreeRoleEntry } from '../src/insights/letter-three-role-render.js';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';

const entry = (modelId: string, over: Partial<ThreeRoleEntry> = {}): ThreeRoleEntry => ({
  modelId, rank: 1, score: 72.2, effort: 'medium', isPareto: true, ...over });
const lists = (n: number) => Array.from({ length: n }, (_, i) => entry(`model-${i + 1}`, { rank: i + 1, score: 100 - i }));

test('세 역할 섹션이 각각 그려진다', () => {
  const md = renderThreeRoleMarkdown({ orchestrator: lists(2), reviewer: lists(1), worker: lists(3), depth: 7 });
  for (const heading of ['🧭 오케스트레이터', '🔍 리뷰어', '🛠️ 워커·메신저']) assert.ok(md.includes(heading), heading);
  assert.ok(md.includes('## 📖 표시 안내'), '범례');
  assert.equal((md.match(/\| 순위 \| 파레토 \| 모델 \| 스코어 \| effort \| 비고 \|/g) ?? []).length, 3, '역할별 표 머리 3개');
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
  assert.ok(md.includes('| 1 |  | plain-model | - | - | - |'), md);
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
