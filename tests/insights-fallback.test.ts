import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { SourceError } from '../src/app/usage-source.js';
import { SqliteInsightHistory } from '../src/infra/sqlite/insights-store.js';
import { migrate, INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/migrations.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS } from '../src/insights/run-once-steps.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { validateInsightRows } from '../src/insights/validation.js';

const createHistory = () => {
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS);
  return new SqliteInsightHistory(db);
};
const aaKey = {
  source: 'artificial-analysis' as const, publicationDate: '2026-10-14',
  requestScope: DEFAULT_REQUEST_SCOPES['artificial-analysis'], schemaVersion: DEFAULT_SCHEMA_VERSIONS['artificial-analysis'],
};
const dummyRow = (id: string, value: number) => ({
  id, slug: id, name: id, release_date: null, model_creator: { id: 'c', name: 'C' },
  evaluations: { artificial_analysis_intelligence_index: value }, pricing: {}, performance: {},
});
const aaPayload = (items: ReturnType<typeof dummyRow>[]) => ({
  tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 10, total_pages: 1, has_more: false }, data: items,
});
const failingPort = (code: 'unavailable' | 'authentication'): InsightSourcePort => ({
  id: 'artificial-analysis', parse: parseAaResponse, fetch: async () => { throw new SourceError(code); },
});

test('AA 수집 일시 실패 시 partial 저장본(rejectedRows>0)을 fallback으로 재사용한다', async () => {
  const history = createHistory();
  const v = validateInsightRows('artificial-analysis', parseAaResponse(aaPayload([dummyRow('m-1', 40), dummyRow('m-2', 50)]), '2026-10-14T00:00:00Z'));
  assert.ok(v.ok && history.saveDaily(aaKey, { ...v, rejectedRows: 1 }, { complete: false }));
  const run = await runInsightsOnce({ ports: [failingPort('unavailable')], history, now: () => '2026-10-14T10:00:00.000Z' });
  const rep = run.sources.find(s => s.source === 'artificial-analysis');
  assert.deepEqual([rep?.status, rep?.partial, rep?.rejectedRows, rep?.reason], ['reused', true, 1, 'unavailable']);
  assert.ok(run.top10?.records.some(r => r.modelId === 'm-1'));
  assert.ok(run.letter.ok && run.letter.sections.some(x => x.kind === 'failures' && x.entries.some(e => e.source === 'artificial-analysis')));
});

test('저장본 부재, complete 저장본 refresh 실패, 비일시적 오류는 폴백하지 않고 failed 반환한다', async () => {
  const now = () => '2026-10-14T10:00:00.000Z';
  // 1. 저장본 없음
  const r1 = await runInsightsOnce({ ports: [failingPort('unavailable')], history: createHistory(), now });
  assert.equal(r1.sources.find(s => s.source === 'artificial-analysis')?.status, 'failed');

  // 2. --refresh + complete 저장본(rejectedRows=0) 상태에서 수집 실패 시 complete를 partial로 둔갑시키지 않고 failed
  const h2 = createHistory();
  const v = validateInsightRows('artificial-analysis', parseAaResponse(aaPayload([dummyRow('m-1', 40)]), '2026-10-14T00:00:00Z'));
  assert.ok(v.ok && h2.saveDaily(aaKey, v, { complete: true }));
  const r2 = await runInsightsOnce({ ports: [failingPort('unavailable')], history: h2, now, refresh: true });
  assert.equal(r2.sources.find(s => s.source === 'artificial-analysis')?.status, 'failed');

  // 3. 비일시적 오류(authentication)는 partial 저장본이 있어도 폴백 없이 failed
  const h3 = createHistory();
  assert.ok(v.ok && h3.saveDaily(aaKey, { ...v, rejectedRows: 1 }, { complete: false }));
  const r3 = await runInsightsOnce({ ports: [failingPort('authentication')], history: h3, now });
  assert.equal(r3.sources.find(s => s.source === 'artificial-analysis')?.status, 'failed');
});
