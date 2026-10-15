import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { classifyAaReject } from '../src/insights/aa-reject-reasons.js';
import { validateInsightRows } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const AT = '2026-10-13T00:00:00.000Z';
const base: InsightRecord = { source: 'openrouter', modelId: 'synthetic', metric: 'rating', value: 0,
  unit: 'score', category: 'Text', observedAt: AT, sourceAsOf: '2026-10-10', metadata: { date: '2026-10-10' },
  sourceUrl: 'https://example.test/data', sourceName: 'Synthetic', license: null,
  attributionText: 'Synthetic attribution', method: 'synthetic', schemaVersion: 'v1' };
const okRow = (...records: InsightRecord[]): ParseRowResult => ({ ok: true, index: 0, records, warnings: [] });
const codedFail: ParseRowResult = JSON.parse(JSON.stringify({ ok: false, index: 1, reason: 'x',
  warnings: [], rejectCode: 'missing-id', rejectFields: ['slug'] }));
const goodBase = { id: 'i', slug: 's', name: 'n', release_date: null, model_creator: { id: 'c', name: 'C' },
  evaluations: {}, pricing: {}, performance: {} };
const envelope = (data: readonly unknown[]) => ({ tier: 'free', intelligence_index_version: 4,
  pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false }, data });
const failedOf = (row: unknown) => {
  const rows = parseAaResponse(envelope([row]), AT);
  assert.equal(rows.filter(r => !r.ok).length, 1);
  return rows[0] as { readonly rejectCode?: unknown; readonly rejectFields?: unknown };
};

test('비-AA 소스 실패 행은 진단 없이 집계에서 제외된다', () => {
  const mixed = validateInsightRows('openrouter', [okRow(base), codedFail]);
  if (!mixed.ok) assert.fail('ok expected');
  assert.equal(mixed.rejectedRows, 1);
  assert.ok(!('rejectedReasons' in mixed) && !('rejectedFields' in mixed));
});

test('AA 검증 거절도 코드 allowlist 밖에서는 other로만 집계된다', () => {
  const aaRecord = { ...base, source: 'artificial-analysis' as const };
  const mixed = validateInsightRows('artificial-analysis', [okRow(aaRecord), okRow(base)]);
  if (!mixed.ok) assert.fail('ok expected');
  assert.equal(mixed.rejectedRows, 1);
  assert.deepEqual([mixed.rejectedReasons, mixed.rejectedFields], [{ other: 1 }, {}]);
});

test('nested cost 오류는 원천 필드 경로로 분류된다', () => {
  const badTotal = { ...goodBase, artificial_analysis_intelligence_index_cost: { total_cost: 'bad' } };
  assert.deepEqual([failedOf(badTotal).rejectCode, failedOf(badTotal).rejectFields],
    ['bad-number', ['artificial_analysis_intelligence_index_cost.total_cost']]);
  assert.deepEqual(classifyAaReject({ ...goodBase,
    artificial_analysis_intelligence_index_cost: { cost_per_task: 7 } }).fields,
  ['artificial_analysis_intelligence_index_cost.cost_per_task']);
  assert.deepEqual(classifyAaReject({ ...goodBase, artificial_analysis_intelligence_index_cost:
    { cost_per_task: { total_cost: -3 } } }).fields,
  ['artificial_analysis_intelligence_index_cost.cost_per_task.total_cost']);
  const dumped = JSON.stringify([failedOf(badTotal)]);
  assert.ok(!dumped.includes('"total_cost":"bad"'), '원천 값 미노출');
});
