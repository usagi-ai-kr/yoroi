import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { SqliteInsightHistory } from '../src/infra/sqlite/insights-store.js';
import { migrate, INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/migrations.js';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import type { InsightDailyKey, InsightHistoryPort, InsightSuccess } from '../src/insights/history-port.js';
import type { InsightSource } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import type { InsightValidation } from '../src/insights/validation.js';
import { AA_FULL_REQUEST_SCOPE, parseAaPages } from '../src/insights/sources-aa.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { selectAaReportRecords } from '../src/insights/report-cohort.js';
const AT = '2026-10-13T00:00:00.000Z';
const model = (i: number) => ({ id: `id-${i}`, slug: `m-${String(i).padStart(2, '0')}`, name: `M${i}`, release_date: null,
  model_creator: { id: 'c', name: 'C' },
  evaluations: { artificial_analysis_coding_index: 120 - i, artificial_analysis_intelligence_index: 100 - i },
  pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 },
  performance: { median_output_tokens_per_second: 40 } });
const page = { tier: 'free', intelligence_index_version: 4, pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false },
  data: Array.from({ length: 60 }, (_, i) => model(i)) };
const aaPort: InsightSourcePort = { id: 'artificial-analysis', fetch: async () => [{ page: 1, payload: page }],
  parse: (payload, at) => parseAaPages(payload, at, {}) };
const run = (history: InsightHistoryPort, requestScopes?: Partial<Record<InsightSource, string>>) =>
  runInsightsOnce({ ports: [aaPort], history, now: () => AT, ...(requestScopes && { requestScopes }) });
class StoredValueHistory extends MemoryInsightHistory {
  readonly keys: InsightDailyKey[] = [];
  override getDaily(key: InsightDailyKey): InsightSuccess | undefined { this.keys.push(key); return super.getDaily(key); }
  override saveDaily(key: InsightDailyKey, result: InsightValidation,
    options: { readonly refresh?: boolean; readonly complete?: boolean } = {}): boolean {
    return result.ok ? super.saveDaily(key, { ...result, records: result.records.map(v =>
      ({ ...v, record: { ...v.record, value: v.record.value + 100 } })) }, options) : false;
  }
}
class RefusingHistory extends MemoryInsightHistory {
  override getDaily(): InsightSuccess | undefined { return undefined; }
  override saveDaily(): boolean { return false; }
}
test('렌더 입력은 저장본 재조회 결과만 쓴다(저장 시 값이 바뀌면 바뀐 값이 보인다)', async () => {
  const history = new StoredValueHistory();
  const result = await run(history);
  assert.deepEqual([result.sources[0]?.status, result.sources[0]?.saved], ['collected', true]);
  assert.ok(result.top10?.records.some(r => r.modelId === 'm-00' &&
    r.metric === 'artificial_analysis_intelligence_index' && r.value === 200)); // 원본 100이 아니라 저장본(+100)
  assert.equal(history.keys[0]!.requestScope, AA_FULL_REQUEST_SCOPE);
});
test('저장이 거부되고 재조회도 비면 소스 실패 — 미저장 validation으로 레터를 만들지 않는다', async () => {
  const result = await run(new RefusingHistory());
  assert.deepEqual([result.sources[0]?.status, result.sources[0]?.failure, result.sources[0]?.reason],
    ['failed', 'parse', 'stored-write-skipped']);
  assert.equal(result.exitCode, 1);
  assert.equal(result.top10?.records.length, 0);
});
test('기본·주입 scope 모두 저장/재조회와 전일 조회에 일관되게 쓰인다', async () => {
  const history = new StoredValueHistory();
  await run(history);
  const today = history.keys.filter(k => k.source === 'artificial-analysis' && k.publicationDate === '2026-10-13');
  const previous = history.keys.filter(k => k.source === 'artificial-analysis' && k.publicationDate === '2026-10-12');
  assert.ok(today.length >= 2); // 오늘 사전·사후 재조회
  assert.ok(today.every(k => k.requestScope === AA_FULL_REQUEST_SCOPE));
  assert.equal(previous[0]?.requestScope, AA_FULL_REQUEST_SCOPE); // 전일도 새 scope 우선(p8 legacy fallback은 그다음)
  const custom = new StoredValueHistory();
  await run(custom, { 'artificial-analysis': 'custom-scope' });
  assert.ok(custom.keys.filter(k => k.source === 'artificial-analysis' && k.publicationDate === '2026-10-13')
    .every(k => k.requestScope === 'custom-scope'));
});
test('AA Top10 후보 풀은 전체 records: top50 조회 선택 밖 모델도 풀에 남는다', async () => {
  const history = new StoredValueHistory();
  const result = await run(history);
  assert.ok(result.top10?.records.some(r => r.modelId === 'm-59')); // 저장 전체에서 후보 풀 구성
  const stored = history.getDaily({ source: 'artificial-analysis', publicationDate: '2026-10-13',
    requestScope: AA_FULL_REQUEST_SCOPE, schemaVersion: 'aa-v2-free' });
  assert.ok(stored?.ok);
  assert.ok(!selectAaReportRecords(stored.records.map(v => v.record)).some(r => r.modelId === 'm-59')); // 조회 선택기는 제외
});

test('SQLite partial은 재조회로 표시하고 완전 저장으로 복구한 뒤 partial refresh는 덮지 않는다', async (t) => {
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS); t.after(() => db.close());
  const history = new SqliteInsightHistory(db);
  const partialPort: InsightSourcePort = { ...aaPort, parse: (payload, at) => [
    ...parseAaPages(payload, at, {}).slice(0, 59), { ok: false, index: 99, reason: 'synthetic', warnings: [] }] };
  const deps = { history, now: () => AT, ports: [partialPort] };
  const first = await runInsightsOnce(deps);
  assert.deepEqual([first.sources[0]?.partial, first.sources[0]?.saved, first.exitCode], [true, true, 0]);
  assert.equal(db.prepare('SELECT complete FROM insight_daily').get()?.complete, 0);
  const key = { source: 'artificial-analysis' as const, publicationDate: '2026-10-13', requestScope: AA_FULL_REQUEST_SCOPE, schemaVersion: 'aa-v2-free' };
  assert.equal(history.getDaily(key), undefined); // partial은 완료 캐시·전일 순위 조회에서 제외
  assert.equal(history.getDaily(key, { includePartial: true })?.rejectedRows, 1);
  assert.equal(first.top10?.records.some(r => r.modelId === 'm-59'), false);
  const recovered = await runInsightsOnce({ ...deps, ports: [aaPort] });
  assert.equal(recovered.sources[0]?.saved, true); assert.equal(recovered.sources[0]?.partial, undefined);
  assert.equal(db.prepare('SELECT complete FROM insight_daily').get()?.complete, 1);
  const protectedRun = await runInsightsOnce({ ...deps, refresh: true });
  assert.deepEqual([protectedRun.sources[0]?.saved, protectedRun.sources[0]?.partial, protectedRun.sources[0]?.rejectedRows], [false, undefined, 0]);
  assert.ok(protectedRun.top10?.records.some(r => r.modelId === 'm-59'));
  assert.equal(db.prepare('SELECT complete FROM insight_daily').get()?.complete, 1);
  const rejected = await runInsightsOnce({ ...deps, ports: [{ ...aaPort, parse: () => [{ ok: false, index: 0, reason: 'bad', warnings: [] }] }], refresh: true });
  assert.equal(rejected.sources[0]?.status, 'failed');
  assert.equal(db.prepare('SELECT complete FROM insight_daily').get()?.complete, 1);
});
