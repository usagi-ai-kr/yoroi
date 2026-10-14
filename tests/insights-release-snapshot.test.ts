import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { trailingSnapshot } from '../src/insights/model-id.js';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';

const METRIC = 'artificial_analysis_coding_index';
const row = (modelId: string, value: number, modelAlias?: string) =>
  ({ modelId, value, metric: METRIC, ...(modelAlias !== undefined && { modelAlias }) });

test('trailingSnapshot은 세 표기를 읽고 연도 없는 mmdd는 fullDate 없이 표시한다', () => {
  assert.deepEqual(trailingSnapshot('deepseek-v4-pro-0424'), { raw: '0424', kind: 'mmdd', fullDate: null });
  assert.deepEqual(trailingSnapshot('xiaomi/mimo-v2.5-20260422'), { raw: '0422', kind: 'compact', fullDate: '2026-04-22' });
  assert.deepEqual(trailingSnapshot('foo-2025-11-01'), { raw: '2025-11-01', kind: 'iso', fullDate: '2025-11-01' });
  assert.deepEqual(trailingSnapshot('claude-opus-4-5-20251101'), { raw: '1101', kind: 'compact', fullDate: '2025-11-01' });
  assert.equal(trailingSnapshot('glm-5-3'), undefined);
  assert.equal(trailingSnapshot('gpt-4o-2024'), undefined); // 연도 단독·무효 날짜는 스냅샷 아님
});

test('deepseek-v4-pro: 0424(max 59.4/high 58.7)와 0813(max 68.8)이 섞이면 0813 행만 남는다', () => {
  const records = [row('deepseek-v4-pro-0424', 59.4, 'DeepSeek V4 Pro (Max)'),
    row('deepseek-v4-pro-0424', 58.7, 'DeepSeek V4 Pro (High)'),
    row('deepseek-v4-pro-0813', 68.8, 'DeepSeek V4 Pro (Max)')];
  const pool = buildCandidatePool(records, PLAN_CATALOG);
  assert.deepEqual([pool.allRecords.length, pool.allRecords[0]?.modelId, pool.allRecords[0]?.value],
    [1, 'deepseek-v4-pro', 68.8]); // 0424 High(58.7)가 다른 effort 키였어도 함께 제거된다
  assert.deepEqual(pool.releaseWarnings, []); // 같은 mmdd 표기끼리만 비교: 비교 보류 아님
});

test('단일 스냅샷 모델과 날짜 없는 id는 그대로 유지된다', () => {
  const records = [row('deepseek-v4-pro-0813', 68.8), row('glm-5-3', 74.8), row('kimi-k3', 76.2)];
  const pool = buildCandidatePool(records, PLAN_CATALOG);
  const ids = new Set(pool.allRecords.map(r => r.modelId));
  assert.deepEqual([...ids].sort(), ['deepseek-v4-pro', 'glm-5-3', 'kimi-k3']); // 단일 스냅샷은 정규화 id 그대로 유지
  assert.deepEqual(pool.releaseWarnings, []);
});

test('날짜 없는 행과 날짜 있는 행이 섞이면 둘 다 유지하고 경고로 보고한다', () => {
  const records = [row('deepseek-v4-flash-0813', 65), { modelId: 'deepseek-v4-flash', value: 64, metric: 'artificial_analysis_intelligence_index' }];
  const pool = buildCandidatePool(records, PLAN_CATALOG);
  assert.deepEqual([...new Set(pool.allRecords.map(r => r.modelId))], ['deepseek-v4-flash']); // 제거 없이 둘 다 유지
  assert.equal(pool.allRecords.length, 2);
  assert.equal(pool.releaseWarnings.length, 1);
  assert.match(pool.releaseWarnings[0]!, /deepseek-v4-flash/);
});

test('releaseDate가 모두 있으면 가장 늦은 릴리스 행만 남긴다(무날짜 신 릴리스 포함)', () => {
  const dated = (modelId: string, value: number, releaseDate: string, modelAlias?: string) =>
    ({ modelId, value, metric: METRIC, releaseDate, ...(modelAlias !== undefined && { modelAlias }) });
  const pool = buildCandidatePool([dated('deepseek-v4-pro', 68.8, '2026-08-13', 'DeepSeek V4 Pro (Max)'),
    dated('deepseek-v4-pro-0424', 59.4, '2026-04-24', 'DeepSeek V4 Pro (Max)'),
    dated('deepseek-v4-pro-0424-high', 58.7, '2026-04-24', 'DeepSeek V4 Pro (High)')], PLAN_CATALOG);
  assert.deepEqual([pool.allRecords.length, pool.allRecords[0]?.value, pool.allRecords[0]?.modelId],
    [1, 68.8, 'deepseek-v4-pro']); // 0424·0424-high 모두 같은 원본 id 계열로 함께 제거
  assert.deepEqual(pool.releaseWarnings, []);
});

test('무날짜 id가 더 오래된 릴리스면(deepseek-v3) 날짜 있는 쪽이 남는다', () => {
  const dated = (modelId: string, value: number, releaseDate: string) => ({ modelId, value, metric: METRIC, releaseDate });
  const pool = buildCandidatePool([dated('deepseek-v3', 40, '2024-12-26'), dated('deepseek-v3-0324', 50, '2025-03-25')], PLAN_CATALOG);
  assert.deepEqual([pool.allRecords.length, pool.allRecords[0]?.value], [1, 50]); // 접미사 모양이 아니라 releaseDate로 판정
  assert.deepEqual(pool.releaseWarnings, []);
});

test('releaseDate가 일부만 있으면 스냅샷 fallback, 비교 불가면 모두 유지+경고', () => {
  const partial = (modelId: string, value: number, releaseDate?: string) =>
    ({ modelId, value, metric: METRIC, ...(releaseDate !== undefined && { releaseDate }) });
  const fallback = buildCandidatePool([partial('deepseek-v4-pro-0424', 59.4), partial('deepseek-v4-pro-0813', 68.8)], PLAN_CATALOG);
  assert.deepEqual([fallback.allRecords.length, fallback.allRecords[0]?.value], [1, 68.8]); // p20 스냅샷 fallback
  const stuck = buildCandidatePool([partial('deepseek-v4-pro', 68.8, '2026-08-13'),
    { modelId: 'deepseek-v4-pro-0424', value: 59.4, metric: 'artificial_analysis_intelligence_index' }], PLAN_CATALOG);
  assert.equal(stuck.allRecords.length, 2); // 결측+비교 불가 → 모두 유지(서로 다른 지표로 dedupe 통과)
  assert.match(stuck.releaseWarnings[0] ?? '', /releaseDate 결측/);
});

test('근거 행(total_tokens·opencode_data_tokens)은 판정에서 빠지고 AA releaseDate 판정은 그대로 동작한다', () => {
  const aa = (modelId: string, value: number, releaseDate: string) => ({ modelId, value, metric: METRIC, releaseDate });
  const pool = buildCandidatePool([aa('deepseek-v4-pro-0424', 59.4, '2026-04-24'), aa('deepseek-v4-pro', 68.8, '2026-08-13'),
    { modelId: 'deepseek/deepseek-v4-pro-20260813', value: 123, metric: 'total_tokens' },
    { modelId: 'deepseek-v4-pro', value: 55, metric: 'opencode_data_tokens' }], PLAN_CATALOG);
  const aaRows = pool.allRecords.filter(r => r.metric === METRIC);
  assert.deepEqual([aaRows.length, aaRows[0]?.value], [1, 68.8]); // AA 0424는 releaseDate 판정으로 제거
  assert.deepEqual(pool.allRecords.filter(r => r.metric === 'total_tokens').length, 1); // 근거 유지
  assert.deepEqual(pool.allRecords.filter(r => r.metric === 'opencode_data_tokens').length, 1);
  assert.deepEqual(pool.releaseWarnings, []); // 근거 행이 결측 fallback 경고를 만들지 않는다
});

test('mmdd와 full-date가 섞이면(연도 없음) 비교를 보류하고 둘 다 유지한다', () => {
  const records = [row('mimo-v2-5-0424', 56.8), { modelId: 'xiaomi/mimo-v2.5-20260422', value: 55, metric: 'artificial_analysis_intelligence_index' }];
  const pool = buildCandidatePool(records, PLAN_CATALOG);
  assert.equal(pool.allRecords.length, 2); // 연도 없는 mmdd와 full-date는 서로 비교하지 않음 → 둘 다 유지
  assert.deepEqual(pool.releaseWarnings, []); // 경고는 무날짜 혼합에만 붙는다
});
