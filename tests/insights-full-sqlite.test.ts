import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { openInsightsHistory } from '../src/infra/sqlite/insights-store.js';
import { DEFAULT_REQUEST_SCOPES } from '../src/insights/run-once-steps.js';
import type { InsightDailyKey, InsightSeriesKey } from '../src/insights/history-port.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';
import type { InsightRecord } from '../src/insights/record.js';
import { validateInsightRows, type InsightValidation } from '../src/insights/validation.js';

const roots: string[] = [];
function sqlite(): ReturnType<typeof openInsightsHistory> {   // 매 케이스 새 임시 DB(실제 마이그레이션 포함)
  const root = mkdtempSync(join(tmpdir(), 'yoroi-full-sqlite-'));
  roots.push(root);
  return openInsightsHistory({ YOROI_DATA_DIR: join(root, 'data') });
}
test.after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });
const withStore = <T>(run: (store: ReturnType<typeof openInsightsHistory>) => T): T => {
  const store = sqlite();
  try { return run(store); } finally { store.close(); }
};

const METRICS = ['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index',
  'median_output_tokens_per_second'] as const;
const AA_SCHEMA = 'aa-v2-free', AA_SCOPE = DEFAULT_REQUEST_SCOPES['artificial-analysis'];
const aaRecord = (modelId: string, metric: string, value: number): InsightRecord => ({
  source: 'artificial-analysis', modelId, metric, value,
  unit: metric.endsWith('per_second') ? 'tokens/s' : 'index',
  category: metric.includes('coding') ? 'Coding' : 'Intelligence',
  observedAt: '2026-10-13T00:00:00Z', sourceAsOf: '2026-10-12', // 기준일 미상 합성
  sourceUrl: 'https://artificialanalysis.test/synthetic', sourceName: 'Artificial Analysis',
  license: null, attributionText: 'Synthetic fixture', method: 'synthetic-json', schemaVersion: AA_SCHEMA });
/** 120 모델 × 3 지표 = 360 유효 측정: 기존 4페이지 선택 컷(148)보다 큰 전체 합성 페이로드. */
const aaFull = (): InsightValidation => validateInsightRows('artificial-analysis',
  Array.from({ length: 120 }, (_, i) => ({ ok: true, index: i, warnings: [],
    records: METRICS.map(m => aaRecord(`synthetic-model-${i}`, m, i + 1)) })));
const aaKey = (publicationDate: string): InsightDailyKey =>
  ({ source: 'artificial-analysis', publicationDate, requestScope: AA_SCOPE, schemaVersion: AA_SCHEMA });
const orRecord = (modelId: string, value: number, date: string): InsightRecord => ({
  source: 'openrouter', modelId, metric: 'total_tokens', value, unit: 'tokens', category: 'Rankings',
  observedAt: '2026-10-13T00:00:00Z', sourceAsOf: '2026-10-13', metadata: { date },
  sourceUrl: 'https://openrouter.test/rankings', sourceName: 'OpenRouter', license: null,
  attributionText: 'Synthetic fixture', method: 'synthetic-json', schemaVersion: 'openrouter-rankings-v1' });

test('임시 SQLite roundtrip: 전체 적재한 페이로드가 재조회에서 그대로 돌아온다(컷 없음)', () => {
  withStore(store => {
    const key = aaKey('2026-10-13'), success = aaFull();
    assert.ok(success.ok, '합성 AA 페이로드는 유효해야 한다');
    assert.ok(success.records.length > 148, '합성 페이로드는 기존 선택 컷보다 크다');
    assert.equal(store.saveDaily(key, success), true);
    const read = store.getDaily(key);
    assert.equal(read?.records.length, success.records.length);
    for (let i = 0; i < success.records.length; i++)
      assert.deepEqual(read!.records[i]!.record, success.records[i]!.record, `행 ${i} 보존`);
    assert.ok(key.requestScope.endsWith(':all'), '전체 수집 scope로 적재한다');
  });
});

test('AA 기준일 미상(null) 측정은 daily에만 남고 insight_history·전일 비교에는 없다(3-A)', () => {
  withStore(store => {
    const key = aaKey('2026-10-13');
    assert.equal(store.saveDaily(key, aaFull()), true);
    assert.equal(store.getDaily(key)?.records.length, 360);
    const series: InsightSeriesKey = { source: 'artificial-analysis', modelId: 'synthetic-model-1',
      metric: 'artificial_analysis_coding_index', unit: 'index', category: 'Coding',
      requestScope: AA_SCOPE, schemaVersion: AA_SCHEMA };
    assert.equal(store.previous(series, '2026-10-13'), undefined, '관측일 fallback 비교 금지');
    assert.equal(store.sevenDays(series, '2026-10-13').every(d => d.measurement === undefined), true);
  });
});

test('기준일이 확인된 소스(OpenRouter)는 같은 임시 DB에서 전일 조회가 된다(3-A 경계)', () => {
  withStore(store => {
    const key: InsightDailyKey = { source: 'openrouter', publicationDate: '2026-10-13',
      requestScope: DEFAULT_REQUEST_SCOPES['openrouter'], schemaVersion: 'openrouter-rankings-v1' };
    const rows: readonly ParseRowResult[] = [
      { ok: true, index: 0, records: [orRecord('a-model', 10, '2026-10-12')], warnings: [] },
      { ok: true, index: 1, records: [orRecord('b-model', 11, '2026-10-12')], warnings: [] }];
    assert.equal(store.saveDaily(key, validateInsightRows('openrouter', rows)), true);
    const series: InsightSeriesKey = { source: 'openrouter', modelId: 'b-model', metric: 'total_tokens',
      unit: 'tokens', category: 'Rankings', requestScope: key.requestScope, schemaVersion: key.schemaVersion };
    assert.equal(store.previous(series, '2026-10-13')?.record.value, 11, '기준일 있으면 히스토리에 적재');
  });
});

test('일일 재사용은 막고 수동 refresh만 갱신하며 90일 보존 프루닝이 동작한다(4-A)', () => {
  withStore(store => {
    const key = aaKey('2026-10-13'), old = aaKey('2026-06-01');
    assert.equal(store.saveDaily(old, aaFull()), true);
    assert.equal(store.saveDaily(key, aaFull()), true);
    assert.equal(store.saveDaily(key, aaFull()), false, '같은 키 재사용 차단');
    assert.equal(store.saveDaily(key, aaFull(), { refresh: true }), true, '수동 refresh만 갱신');
    assert.equal(store.prune('2026-10-13'), 1, '90일 지난 일일 스냅샷 제거');
    assert.equal(store.getDaily(old), undefined);
    assert.equal(store.getDaily(key)?.records.length, 360);
  });
});
