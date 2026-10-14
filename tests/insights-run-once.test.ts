import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { parseCognitionResponse } from '../src/insights/cognition-parser.js';
import { parseOpenCodeDataJson } from '../src/insights/opencode-data-json-parser.js';
import { parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';
import type { InsightSource } from '../src/insights/record.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { DatabaseSync } from 'node:sqlite';
import { SqliteInsightHistory } from '../src/infra/sqlite/insights-store.js';
import { migrate, INSIGHTS_MIGRATIONS } from '../src/infra/sqlite/migrations.js';

const arenaRow = (i: number, date = '2026-10-08') => ({ model_name: `m${i}`, organization: 'o', license: 'L', rating: 1500 - i, rating_lower: 1490, rating_upper: 1510,
  variance: 2, vote_count: 10 + i, rank: i + 1, category: 'overall', leaderboard_publish_date: date });
/** arena-parser 삭제(p16) 후 테스트 전용 최소 파서: 주입 포트 검증에 필요한 필드만 옮긴다. */
const parseArenaStub = (payload: unknown, at: string): readonly ParseRowResult[] =>
  (payload as Record<string, unknown>[]).map((row, index): ParseRowResult =>
    typeof row.model_name === 'string' && typeof row.category === 'string' && typeof row.leaderboard_publish_date === 'string' &&
      typeof row.rating === 'number'
      ? { ok: true, index, warnings: [], records: [{ source: 'arena', modelId: row.model_name, metric: 'rating', value: row.rating,
        unit: 'score', category: row.category, observedAt: at, sourceAsOf: row.leaderboard_publish_date,
        sourceUrl: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset', sourceName: 'lmarena-ai LMArena Leaderboard Dataset',
        license: 'CC-BY-4.0', attributionText: 'Source: lmarena-ai LMArena Leaderboard Dataset (CC-BY-4.0)',
        method: 'bradley-terry', schemaVersion: 'arena-hf-v1' }] }
      : { ok: false, index, reason: 'Arena row invalid-row', warnings: [] });
const payloads = {
  arena: (): unknown => [arenaRow(0), arenaRow(1), arenaRow(2)],
  'artificial-analysis': (): unknown => ({ tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 10, total_pages: 1, has_more: false },
    data: [{ id: 'a', slug: 'a', name: 'A', release_date: null, model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: 42 }, pricing: {}, performance: {} }] }),
  openrouter: (): unknown => ({ meta: { as_of: '2026-10-07T00:00:00Z', start_date: '2026-10-01', end_date: '2026-10-07', version: 'v1' },
    data: [{ date: '2026-10-07', model_permaslug: 'gpt-5', total_tokens: 123 }] }),
  cognition: (): unknown => ({ v1_1: { models: ['M'], subsets: { main: 100 }, data: { M: { high: { main: { correct: 0.5, cost: 1.25 } } } } } }),
  'opencode-data': (): unknown => ({ jsonText: '{"updatedAt":"2026-10-07T00:00:00Z","dailyTokens":[{"date":"2026-10-07","total":1,"models":{"Model-A":1}}]}' }),
};
const parsers = { arena: parseArenaStub, 'artificial-analysis': parseAaResponse, openrouter: parseOpenRouterResponse, cognition: parseCognitionResponse,
  'opencode-data': (p: unknown, at: string) => parseOpenCodeDataJson(JSON.parse((p as { jsonText: string }).jsonText) as unknown, at).rows };
/** Fake four-source ports (real parsers, no network). behavior[id] is a SourceError to throw, or a replacement payload. */
function setup() {
  const calls: Record<string, number> = {}, behavior: Partial<Record<InsightSource, unknown>> = {};
  const ports: InsightSourcePort[] = (Object.keys(payloads) as InsightSource[]).map(id => ({ id, parse: parsers[id],
    fetch: async () => { calls[id] = (calls[id] ?? 0) + 1; const b = behavior[id]; if (b instanceof Error) throw b; return b ?? payloads[id](); } }));
  return { calls, behavior, ports, history: new MemoryInsightHistory(), now: () => '2026-10-08T00:30:00.000Z' };
}
const statuses = (r: Awaited<ReturnType<typeof runInsightsOnce>>) => Object.fromEntries(r.sources.map(s => [s.source, s.failure ?? s.status]));

test('all five sources collected: exit 0, letter sections, every source stored once and reported', async () => {
  const s = setup(); const run = await runInsightsOnce(s);
  assert.deepEqual([run.exitCode, run.publicationDate, run.letter.ok], [0, '2026-10-08', true]);
  assert.deepEqual(statuses(run), { arena: 'collected', 'artificial-analysis': 'collected', openrouter: 'collected', cognition: 'collected', 'opencode-data': 'collected' });
  assert.ok(run.sources.every(r => r.saved === true && r.rejectedRows === 0));
  assert.ok(run.letter.ok && ['metadata', 'summary', 'evidence', 'ranks', 'sources', 'failures', 'limitations'].every(k => run.letter.ok && run.letter.sections.some(x => x.kind === k)));
  assert.ok(run.letter.ok && JSON.stringify(run.letter.sections).includes('n/a: 기준일 미상'));
});
test('same-day rerun reuses stored successes with no fetch; --refresh fetches and replaces them', async () => {
  const s = setup(); await runInsightsOnce(s);
  const again = await runInsightsOnce(s); assert.deepEqual(statuses(again), { arena: 'reused', 'artificial-analysis': 'reused', openrouter: 'reused', cognition: 'reused', 'opencode-data': 'reused' });
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
  assert.deepEqual(statuses(retry), { arena: 'reused', 'artificial-analysis': 'collected', openrouter: 'reused', cognition: 'reused', 'opencode-data': 'reused' });
  assert.deepEqual([s.calls['artificial-analysis'], s.calls.arena], [2, 1]);
});
test('failure kinds remain distinct; partial rows render only after SQLite storage', async (t) => {
  const s = setup(); s.behavior['artificial-analysis'] = new SourceError('network'); s.behavior.openrouter = { nope: 1 };
  s.behavior.cognition = { v1_1: { models: [], subsets: { main: 100 }, data: {} } };
  const kinds = statuses(await runInsightsOnce(s)); assert.equal(kinds['artificial-analysis'], 'fetch'); assert.equal(kinds.openrouter, 'parse'); assert.ok(['empty', 'parse'].includes(kinds.cognition!));
  const allBad = setup(); allBad.behavior.arena = [{ bogus: true }, { bogus: 2 }]; const bad = await runInsightsOnce(allBad);
  assert.deepEqual([statuses(bad).arena, bad.sources[0]?.reason], ['parse', 'all-rows-failed']);
  const db = new DatabaseSync(':memory:'); migrate(db, INSIGHTS_MIGRATIONS); t.after(() => db.close());
  const some = { ...setup(), history: new SqliteInsightHistory(db) }; some.behavior.arena = [arenaRow(0), { bogus: true }];
  const partial = await runInsightsOnce(some);
  assert.deepEqual([partial.sources[0]?.partial, partial.sources[0]?.saved, partial.sources[0]?.rejectedRows, partial.exitCode], [true, true, 1, 0]);
  assert.equal(db.prepare("SELECT complete FROM insight_daily WHERE source='arena'").get()?.complete, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM insight_history WHERE source='arena'").get()?.n, 0);
  assert.ok(partial.letter.ok && partial.letter.sections.some(s => s.kind === 'failures' && s.entries.some(e => e.source === 'arena')));
  const retried = await runInsightsOnce(some); assert.equal(some.calls.arena, 2); assert.equal(retried.sources[0]?.partial, true);
});
test('every source failing is exit 1 with the failed list; nothing is stored; no secrets reach the result', async () => {
  const s = setup(); const secret = 'synthetic-secret-token'; for (const id of Object.keys(payloads) as InsightSource[]) s.behavior[id] = new Error(secret);
  const run = await runInsightsOnce(s);
  assert.deepEqual([run.exitCode, run.letter.ok, !run.letter.ok && run.letter.failedSources.length], [1, false, 5]);
  assert.ok(!JSON.stringify(run).includes(secret)); assert.equal(s.history.getDaily({ source: 'arena', publicationDate: '2026-10-08', requestScope: 'hf-rows:text:latest:overall', schemaVersion: 'arena-hf-v1' }), undefined);
});
test('OpenCode Data aggregate "Other" rows never become evidence rows (like OpenRouter "other")', async () => {
  const s = setup(); s.behavior['opencode-data'] = { jsonText: '{"updatedAt":"2026-10-07T00:00:00Z","dailyTokens":[{"date":"2026-10-07","total":14,"models":{"Model-A":5,"Other":9}}]}' };
  const ids = (await runInsightsOnce(s)).top10?.opencodeDataRecords?.map(r => r.modelId) ?? [];
  assert.deepEqual(ids, ['Model-A']);
});
