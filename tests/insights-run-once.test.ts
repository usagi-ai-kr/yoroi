import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { parseOpenCodeDataJson } from '../src/insights/opencode-data-json-parser.js';
import { parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';
import type { InsightSource } from '../src/insights/record.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS } from '../src/insights/run-once-steps.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';
import { DatabaseSync } from 'node:sqlite';
import { SqliteInsightHistory } from '../src/infra/sqlite/insights-store.js';
import { migrate, INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/migrations.js';

const orMeta = { as_of: '2026-10-07T00:00:00Z', start_date: '2026-10-01', end_date: '2026-10-07', version: 'v1' };
const orRow = { date: '2026-10-07', model_permaslug: 'gpt-5', total_tokens: 123 };
const payloads: Readonly<Record<string, () => unknown>> = {
  'artificial-analysis': (): unknown => ({ tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 10, total_pages: 1, has_more: false },
    data: [{ id: 'a', slug: 'a', name: 'A', release_date: null, model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: 42 }, pricing: {}, performance: {} }] }),
  openrouter: (): unknown => ({ meta: orMeta, data: [orRow] }),
  cognition: (): unknown => ({ v1_1: { models: ['M'], subsets: { main: 100 }, data: { M: { high: { main: { correct: 0.5, cost: 1.25 } } } } } }),
  'opencode-data': (): unknown => ({ jsonText: '{"updatedAt":"2026-10-07T00:00:00Z","dailyTokens":[{"date":"2026-10-07","total":1,"models":{"Model-A":1}}]}' }),
};
const parsers: Readonly<Record<string, (p: unknown, at: string) => readonly ParseRowResult[]>> = { 'artificial-analysis': parseAaResponse, openrouter: parseOpenRouterResponse, cognition: parseCognitionResponse,
  'opencode-data': (p: unknown, at: string) => parseOpenCodeDataJson(JSON.parse((p as { jsonText: string }).jsonText) as unknown, at).rows };
/** Fake four-source ports (real parsers, no network). behavior[id] is a SourceError to throw, or a replacement payload. */
function setup() {
  const calls: Record<string, number> = {}, behavior: Partial<Record<InsightSource, unknown>> = {};
  const ports: InsightSourcePort[] = (Object.keys(payloads) as InsightSource[]).map(id => ({ id, parse: parsers[id]!,
    fetch: async () => { calls[id] = (calls[id] ?? 0) + 1; const b = behavior[id]; if (b instanceof Error) throw b; return b ?? payloads[id]!(); } }));
  return { calls, behavior, ports, history: new MemoryInsightHistory(), now: () => '2026-10-08T00:30:00.000Z' };
}
const statuses = (r: Awaited<ReturnType<typeof runInsightsOnce>>) => Object.fromEntries(r.sources.map(s => [s.source, s.failure ?? s.status]));

test('all four sources collected: exit 0, letter sections, every source stored once and reported', async () => {
  const s = setup(); const run = await runInsightsOnce(s);
  assert.deepEqual([run.exitCode, run.publicationDate, run.letter.ok], [0, '2026-10-08', true]);
  assert.deepEqual(statuses(run), { 'artificial-analysis': 'collected', openrouter: 'collected', cognition: 'collected', 'opencode-data': 'collected' });
  assert.ok(run.sources.every(r => r.saved === true && r.rejectedRows === 0));
  assert.ok(run.letter.ok && ['metadata', 'summary', 'evidence', 'ranks', 'sources', 'failures', 'limitations'].every(k => run.letter.ok && run.letter.sections.some(x => x.kind === k)));
  assert.ok(run.letter.ok && JSON.stringify(run.letter.sections).includes('n/a: 기준일 미상'));
});
test('same-day rerun reuses stored successes with no fetch; --refresh fetches and replaces them', async () => {
  const s = setup(); await runInsightsOnce(s);
  const again = await runInsightsOnce(s); assert.deepEqual(statuses(again), { 'artificial-analysis': 'reused', openrouter: 'reused', cognition: 'reused', 'opencode-data': 'reused' });
  assert.ok(Object.values(s.calls).every(n => n === 1) && again.exitCode === 0);
  const refreshed = await runInsightsOnce({ ...s, refresh: true }); assert.ok(refreshed.sources.every(r => r.status === 'collected' && r.saved === true));
  assert.ok(Object.values(s.calls).every(n => n === 2));
});
test('a failed source is reported, never stored, retried the same day while the others stay reused; exit stays 0', async () => {
  const s = setup(); s.behavior['artificial-analysis'] = new SourceError('authentication');
  const first = await runInsightsOnce(s);
  assert.deepEqual([first.exitCode, statuses(first)['artificial-analysis'], first.sources.find(r => r.source === 'artificial-analysis')?.reason], [0, 'fetch', 'authentication']);
  assert.ok(first.letter.ok && first.letter.sections.some(x => x.kind === 'failures' && x.entries.some(e => e.source === 'artificial-analysis')));
  delete s.behavior['artificial-analysis'];
  const retry = await runInsightsOnce(s);
  assert.deepEqual(statuses(retry), { 'artificial-analysis': 'collected', openrouter: 'reused', cognition: 'reused', 'opencode-data': 'reused' });
  assert.deepEqual([s.calls['artificial-analysis'], s.calls.openrouter], [2, 1]);
});
test('failure kinds remain distinct; partial rows render only after SQLite storage', async (t) => {
  const s = setup(); s.behavior['artificial-analysis'] = new SourceError('network'); s.behavior.openrouter = { nope: 1 };
  s.behavior.cognition = { v1_1: { models: [], subsets: { main: 100 }, data: {} } };
  const kinds = statuses(await runInsightsOnce(s)); assert.equal(kinds['artificial-analysis'], 'fetch'); assert.equal(kinds.openrouter, 'parse'); assert.ok(['empty', 'parse'].includes(kinds.cognition!));
  const allBad = setup(); allBad.behavior.openrouter = { meta: orMeta, data: [{ bogus: true }, { bogus: 2 }] }; const bad = await runInsightsOnce(allBad);
  assert.deepEqual([statuses(bad).openrouter, bad.sources.find(r => r.source === 'openrouter')?.reason], ['parse', 'all-rows-failed']);
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS); t.after(() => db.close());
  const some = { ...setup(), history: new SqliteInsightHistory(db) }; some.behavior.openrouter = { meta: orMeta, data: [orRow, { bogus: true }] };
  const partial = await runInsightsOnce(some); const or = partial.sources.find(r => r.source === 'openrouter');
  assert.deepEqual([or?.partial, or?.saved, or?.rejectedRows, partial.exitCode], [true, true, 1, 0]);
  assert.equal(db.prepare("SELECT complete FROM insight_daily WHERE source='openrouter'").get()?.complete, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM insight_history WHERE source='openrouter'").get()?.n, 0);
  assert.ok(partial.letter.ok && partial.letter.sections.some(s => s.kind === 'failures' && s.entries.some(e => e.source === 'openrouter')));
  const retried = await runInsightsOnce(some); assert.equal(some.calls.openrouter, 2);
  assert.equal(retried.sources.find(r => r.source === 'openrouter')?.partial, true);
});
test('every source failing is exit 1 with the failed list; nothing is stored; no secrets reach the result', async () => {
  const s = setup(); const secret = 'synthetic-secret-token'; for (const id of Object.keys(payloads) as InsightSource[]) s.behavior[id] = new Error(secret);
  const run = await runInsightsOnce(s);
  assert.deepEqual([run.exitCode, run.letter.ok, !run.letter.ok && run.letter.failedSources.length], [1, false, 4]);
  assert.ok(!JSON.stringify(run).includes(secret)); assert.equal(s.history.getDaily({ source: 'openrouter', publicationDate: '2026-10-08', requestScope: DEFAULT_REQUEST_SCOPES.openrouter, schemaVersion: DEFAULT_SCHEMA_VERSIONS.openrouter }), undefined);
});
test('OpenCode Data aggregate "Other" rows never become evidence rows (like OpenRouter "other")', async () => {
  const s = setup(); s.behavior['opencode-data'] = { jsonText: '{"updatedAt":"2026-10-07T00:00:00Z","dailyTokens":[{"date":"2026-10-07","total":14,"models":{"Model-A":5,"Other":9}}]}' };
  const ids = (await runInsightsOnce(s)).top10?.opencodeDataRecords?.map(r => r.modelId) ?? [];
  assert.deepEqual(ids, ['Model-A']);
});
test('run-once는 하나의 가용성 스냅샷을 previousRanks와 결과 데이터에 함께 쓴다 (#188)', async () => {
  const prev = process.env.YOROI_EFFORT_PROFILE;
  try {
    process.env.YOROI_EFFORT_PROFILE = 'observed-2026-10-19';
    const run = await runInsightsOnce(setup());
    assert.deepEqual(run.top10?.effortAvailability?.activeProfile, 'observed-2026-10-19', '스냅샷이 결과 데이터로 반환된다');
  } finally { if (prev === undefined) delete process.env.YOROI_EFFORT_PROFILE; else process.env.YOROI_EFFORT_PROFILE = prev; }
  const run = await runInsightsOnce(setup());
  assert.deepEqual(run.top10?.effortAvailability?.activeProfile, undefined, '선택자 없으면 프로필 비활성(unlisted 기준)');
});
