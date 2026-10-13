import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAaPages, selectAaTopModels, AA_TOP_N } from '../src/insights/sources-aa.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';
import type { InsightRecord } from '../src/insights/record.js';

const AT = '2026-10-12T00:00:00.000Z';
const model = (slug: string, coding: number | null, intel: number | null = 50) => ({
  id: `id-${slug}`, slug, name: `Model ${slug}`, release_date: null, model_creator: { id: 'c1', name: 'Creator' },
  evaluations: { ...(coding !== null ? { artificial_analysis_coding_index: coding } : {}),
    ...(intel !== null ? { artificial_analysis_intelligence_index: intel } : {}) },
  pricing: {}, performance: {} });
const page = (rows: ReturnType<typeof model>[], total = 1) => ({
  tier: 'free', intelligence_index_version: 4, data: rows,
  pagination: { page: 1, page_size: 200, total_pages: total, has_more: false } });
const slugs = (parsed: readonly ParseRowResult[]): string[] =>
  parsed.filter((row): row is Extract<ParseRowResult, { ok: true }> => row.ok).map(row => row.records[0]!.modelId).sort();
const recordsOf = (parsed: readonly ParseRowResult[]): InsightRecord[] =>
  parsed.flatMap(row => (row.ok ? row.records : []));

test('저장은 전체 유지: 조회 컷 대상(below·fillers)까지 parse가 모두 반환한다', () => {
  const codingTop = Array.from({ length: 50 }, (_, i) => model(`c-${String(100 - i)}`, 100 - i, 10));
  const codingTie = model('c-tie', 51, 10);
  const intelStar = model('i-star', 1, 999);
  const intelTie = model('i-tie', 0, 999);
  const below = model('below', 40, 20);
  const fillers = Array.from({ length: 50 }, (_, i) => model(`f-${i}`, 0, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page([...codingTop, codingTie, intelStar, intelTie, below, ...fillers]) }], AT, {});
  const stored = slugs(parsed);
  assert.equal(stored.length, 104);
  assert.ok(stored.includes('below'), '저장에는 조회 컷 밖 모델도 남는다');
});

test('조회 선택기는 coding top50 UNION intel top50(동점 포함)만 반환한다', () => {
  const codingTop = Array.from({ length: 50 }, (_, i) => model(`c-${String(100 - i)}`, 100 - i, 10));
  const codingTie = model('c-tie', 51, 10);
  const intelStar = model('i-star', 1, 999);
  const intelTie = model('i-tie', 0, 999);
  const below = model('below', 40, 20);
  const fillers = Array.from({ length: 50 }, (_, i) => model(`f-${i}`, 0, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page([...codingTop, codingTie, intelStar, intelTie, below, ...fillers]) }], AT, {});
  const kept = [...new Set(selectAaTopModels(recordsOf(parsed)).map(record => record.modelId))];
  assert.equal(AA_TOP_N, 50);
  for (const id of ['c-100', 'c-51', 'c-tie', 'i-star', 'i-tie']) assert.ok(kept.includes(id), id);
  assert.ok(!kept.includes('below'));
});

test('지표 없는 행은 ok:false로 함께 반환(4-A partial), 지수 있는 행은 저장·조회 모두 유지', () => {
  const onlyIntel = model('only-intel', null, 80);
  const none = model('none', null, null);
  const parsed = parseAaPages([{ page: 1, payload: page([onlyIntel, none]) }], AT, {});
  assert.equal(parsed.length, 2);
  assert.deepEqual(slugs(parsed), ['only-intel']);
  assert.equal(parsed.filter(row => !row.ok).length, 1); // 거절 행은 사라지지 않고 validation partial로 이어진다
  const selected = [...new Set(selectAaTopModels(recordsOf(parsed)).map(record => record.modelId))];
  assert.deepEqual(selected, ['only-intel']);
});

test('50 이하 모델은 저장·조회 모두 전부 유지한다', () => {
  const rows = Array.from({ length: 25 }, (_, i) => model(`m-${100 - i}`, 100 - i));
  const parsed = parseAaPages([{ page: 1, payload: page(rows) }], AT, {});
  assert.equal(parsed.filter(row => row.ok).length, 25);
  assert.equal(new Set(selectAaTopModels(recordsOf(parsed)).map(record => record.modelId)).size, 25);
});
