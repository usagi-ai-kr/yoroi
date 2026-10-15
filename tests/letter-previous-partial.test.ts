import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { SqliteInsightHistory } from '../src/infra/sqlite/insights-store.js';
import { migrate, INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/migrations.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { parseAaPages } from '../src/insights/sources-aa.js';
import { runInsightsOnce } from '../src/insights/run-once.js';

const model = (i: number) => ({ id: `id-${i}`, slug: i === 0 ? 'gpt-6-1-sol' : `m-${String(i).padStart(2, '0')}`,
  name: i === 0 ? 'GPT-6.1 Sol' : `M${i}`, release_date: null,
  model_creator: { id: 'c', name: 'C' },
  evaluations: { artificial_analysis_coding_index: 120 - i, artificial_analysis_intelligence_index: 100 - i },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
  performance: { median_output_tokens_per_second: 40 } });
const page = { tier: 'free', intelligence_index_version: 4, pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false },
  data: Array.from({ length: 60 }, (_, i) => model(i)) };

const aaPort: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => [{ page: 1, payload: page }],
  parse: (payload, at) => parseAaPages(payload, at, {}) };
const partialPort: InsightSourcePort = { ...aaPort, parse: (payload, at) => [
  ...parseAaPages(payload, at, {}).slice(0, 59), { ok: false, index: 99, reason: 'synthetic', warnings: [] }] };

test('전일 partial(complete=0) 행이 있을 때: 전일 AA 자료 없음 경고 없이 전일 랭크 변동 계산', async (t) => {
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS); t.after(() => db.close());
  const history = new SqliteInsightHistory(db);

  // 1일차(2026-10-14): partialPort로 수집·저장 -> complete=0으로 저장됨
  const day1 = await runInsightsOnce({ ports: [partialPort], history, now: () => '2026-10-14T00:00:00.000Z' });
  assert.equal(day1.sources[0]?.partial, true);
  assert.equal(db.prepare('SELECT complete FROM insight_daily WHERE publication_date = ?').get('2026-10-14')?.complete, 0);

  // 2일차(2026-10-15): 정상 수집 -> 전일(2026-10-14) partial 행을 includePartial로 읽어 비교 수행
  const day2 = await runInsightsOnce({ ports: [aaPort], history, now: () => '2026-10-15T00:00:00.000Z' });
  const warnings = day2.top10?.warnings ?? [];
  assert.ok(!warnings.some(w => w.includes('전일 AA 자료 없음')), `경고에 전일 AA 자료 없음이 없어야 함: ${JSON.stringify(warnings)}`);
  assert.ok((day2.top10?.previousRanks.length ?? 0) > 0, '전일 랭크가 산출되어야 함');
});

test('전일 행 자체가 없을 때: 기존 전일 AA 자료 없음 경고 유지 및 비교 보류', async (t) => {
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS); t.after(() => db.close());
  const history = new SqliteInsightHistory(db);

  // 전일 데이터 없이 2026-10-15 첫 수집
  const day = await runInsightsOnce({ ports: [aaPort], history, now: () => '2026-10-15T00:00:00.000Z' });
  const warnings = day.top10?.warnings ?? [];
  assert.ok(warnings.some(w => w.includes('전일 AA 자료 없음')), `경고에 전일 AA 자료 없음이 포함되어야 함: ${JSON.stringify(warnings)}`);
  assert.equal(day.top10?.previousRanks.length, 0, '전일 랭크는 비어 있어야 함');
});
