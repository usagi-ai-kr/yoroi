import assert from 'node:assert/strict';
import test from 'node:test';
import type { InsightRecord } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { selectAaValueTop } from '../src/insights/aa-value-top.js';
import { filterOpenRouterTop50 } from '../src/insights/openrouter-top50.js';
import { filterCognitionTop50 } from '../src/insights/cognition-top50.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { selectAaReportRecords, selectOpenRouterReportRows, selectCognitionReportRows } from '../src/insights/report-cohort.js';

const AT = '2026-10-13T00:00:00Z';
const aaRecord = (modelId: string, value: number): InsightRecord => ({ source: 'artificial-analysis', modelId,
  metric: 'artificial_analysis_coding_index', value, unit: 'score', category: 'language-models', observedAt: AT,
  sourceAsOf: AT, sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis', license: null,
  attributionText: 'x', method: 'official-api', schemaVersion: 'aa-v2-free' });
const aaRecords = Array.from({ length: 60 }, (_, i) => aaRecord(`m-${String(i).padStart(2, '0')}`, 120 - i));

test('AA 조회 선택기는 top50 cohort만 반환하고 저장 전체(입력)는 그대로 둔다', () => {
  const kept = selectAaReportRecords(aaRecords);
  assert.equal(kept.length, 50);
  assert.deepEqual(kept.map(r => r.modelId), selectAaValueTop(aaRecords).map(r => r.modelId));
  assert.ok(!kept.some(r => r.modelId === 'm-59')); // 61점은 cutoff 71 미만
  assert.equal(aaRecords.length, 60);
});

test('AA Top10 후보 풀은 전체 records로 만들어 top50으로 재제한하지 않는다', () => {
  const catalog: PlanCatalogEntry[] = [{ planId: 'p', planName: 'P', models: [{ modelId: 'm-59', displayName: 'M59',
    sourceUrl: 'https://example.invalid', checkedOn: '2026-10-13', verified: true }] }];
  const pool = buildCandidatePool(aaRecords.map(r => ({ modelId: r.modelId, value: r.value, metric: r.metric })), catalog);
  assert.deepEqual(pool.accessibleRecords.map(r => r.modelId), ['m-59']);
  assert.ok(!selectAaReportRecords(aaRecords).some(r => r.modelId === 'm-59'));
});

const orRow = (index: number, slug: string, value: number): ParseRowResult => ({ ok: true, index, warnings: [],
  records: [{ source: 'openrouter', modelId: slug, metric: 'total_tokens', value, unit: 'tokens', category: 'usage',
    observedAt: AT, sourceAsOf: AT, sourceUrl: 'https://openrouter.ai/rankings', sourceName: 'OpenRouter',
    license: 'CC-BY-4.0', attributionText: 'x', method: 'official-api', schemaVersion: 'openrouter-rankings-v1',
    metadata: { date: '2026-10-05' } }] });
const orRows = [...Array.from({ length: 55 }, (_, i) => orRow(i, `or-${String(i).padStart(2, '0')}`, 1000 - i)),
  orRow(55, 'other', 1)];
const cogRow = (modelId: string, correct: number): ParseRowResult => ({ ok: true, index: 0, warnings: [],
  records: [{ source: 'cognition', modelId, metric: 'correct', value: correct, unit: 'ratio', category: 'v1_1/high/main',
    observedAt: AT, sourceAsOf: AT, sourceUrl: 'https://cognition.com/frontiercode', sourceName: 'Cognition FrontierCode',
    license: null, attributionText: 'x', method: 'official-dataset', schemaVersion: 'cognition-frontiercode-v1_1' }] });
const cogRows = Array.from({ length: 55 }, (_, i) => cogRow(`Model ${i}`, 0.9 - i / 100));

test('OpenRouter·Cognition 조회 선택기는 기존 필터 합성이고 입력 rows를 대체하지 않는다', () => {
  const orKept = selectOpenRouterReportRows(orRows);
  assert.equal(orKept.length, 51); // 날짜별 top50 + other 보존
  assert.deepEqual(orKept.map(r => r.index), filterOpenRouterTop50(orRows).map(r => r.index));
  assert.equal(orRows.length, 56);
  const cogKept = selectCognitionReportRows(cogRows);
  assert.equal(cogKept.length, 50);
  assert.deepEqual(cogKept.map(r => r.index), filterCognitionTop50(cogRows).map(r => r.index));
  assert.equal(cogRows.length, 55);
});
