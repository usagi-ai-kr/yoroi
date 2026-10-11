import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { runInsights } from '../src/composition/insights.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { openDetectStateStore } from '../src/infra/sqlite/detect-state-store.js';
import { openInsightsHistory } from '../src/infra/sqlite/insights-store.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';
import { parseArenaRows } from '../src/insights/arena-parser.js';
import { fetchArenaRows } from '../src/insights/arena-transport.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const AA_KEY = 'synthetic-aa-key-must-not-leak', OR_KEY = 'synthetic-or-key-must-not-leak';
const clock = () => Date.parse('2026-10-08T15:30:00Z');   // 2026-10-09 00:30 in KST
const arenaRow = (i: number) => ({ model_name: `m${i}`, organization: 'o', license: 'L', rating: 1500 - i, rating_lower: 1490, rating_upper: 1510, variance: 2,
  vote_count: 10 + i, rank: i + 1, category: 'overall', leaderboard_publish_date: '2026-10-08' });
const bodies: Record<string, unknown> = {
  'datasets-server.huggingface.co': { rows: Array.from({ length: 21 }, (_, i) => ({ row: arenaRow(i) })), num_rows_total: 21, partial: false },
  'artificialanalysis.ai': { tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 10, total_pages: 1, has_more: false },
    data: [{ id: 'a', slug: 'a', name: 'A', release_date: null, model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: 42, artificial_analysis_coding_index: 38 }, pricing: {}, performance: {} }] },
  'openrouter.ai': { meta: { as_of: '2026-10-07T00:00:00Z', start_date: '2026-10-01', end_date: '2026-10-07', version: 'v1' }, data: [{ date: '2026-10-07', model_permaslug: 'gpt-5', total_tokens: 123 }] },
  'cognition.com': { v1_1: { models: ['M'], subsets: { main: 100 }, data: { M: { high: { main: { correct: 0.5, cost: 1.25 } } } } } },
};
function http(status = 200) {
  const requests: HttpRequest[] = [];
  const client: HttpClient = { async request(request): Promise<HttpResponse> { requests.push(request);
    return { status, headers: {}, body: JSON.stringify(bodies[new URL(request.url).host] ?? {}) }; } };
  return { client, requests };
}
const setup = (t: TestContext) => { const dir = mkdtempSync(join(tmpdir(), 'yoroi-insights-comp-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, dataEnv: { YOROI_DATA_DIR: dir }, env: { YOROI_AA_API_KEY: AA_KEY, YOROI_OPENROUTER_API_KEY: OR_KEY } as Record<string, string> }; };
const noWait = { sleep: async () => {} };
const states = (r: { sources: readonly { source: string; status: string; failure?: string }[] }) => Object.fromEntries(r.sources.map(s => [s.source, s.failure ?? s.status]));

test('a run opens its own database, stores per KST day, reuses on rerun and replaces on refresh; keys only travel in headers', async t => {
  const s = setup(t), h = http();
  const first = await runInsights({ ...s, http: h.client, clock });
  assert.deepEqual([first.exitCode, first.storage, first.publicationDate], [0, 'sqlite', '2026-10-09']); assert.equal(h.requests.length, 4);
  assert.ok(first.sources.every(r => r.status === 'collected' && r.saved === true));
  const header = (host: string) => h.requests.find(r => new URL(r.url).host === host)!.headers;
  assert.deepEqual([header('artificialanalysis.ai')?.['x-api-key'], header('openrouter.ai')?.Authorization, header('cognition.com'), header('datasets-server.huggingface.co')], [AA_KEY, `Bearer ${OR_KEY}`, undefined, undefined]);
  assert.ok(!JSON.stringify(first).includes(AA_KEY) && !JSON.stringify(first).includes(OR_KEY) && h.requests.every(r => !r.url.includes('key')));
  const again = await runInsights({ ...s, http: h.client, clock });
  assert.ok(again.sources.every(r => r.status === 'reused')); assert.equal(h.requests.length, 4);
  const refreshed = await runInsights({ ...s, http: h.client, clock, refresh: true });
  assert.ok(refreshed.sources.every(r => r.status === 'collected' && r.saved === true)); assert.equal(h.requests.length, 8);
  assert.equal((await fetchArenaRows(http().client)).boundary, 'rank-above-top');
});
test('a missing key fails only that source before any request; exit stays 0', async t => {
  const s = setup(t), h = http(), { YOROI_AA_API_KEY: _omitted, ...env } = s.env;
  const run = await runInsights({ ...s, env, http: h.client, clock });
  assert.deepEqual([run.exitCode, states(run)['artificial-analysis'], run.sources.find(r => r.source === 'artificial-analysis')?.reason], [0, 'fetch', 'authentication']);
  assert.ok(h.requests.every(r => new URL(r.url).host !== 'artificialanalysis.ai'));
});
test('the database is opened and closed once per run, and an unopenable database degrades to memory without failing', async t => {
  const s = setup(t), h = http(); let opened = 0, closed = 0;
  const openHistory = () => { opened++; const store = openInsightsHistory(s.dataEnv); const close = store.close.bind(store); store.close = () => { closed++; close(); }; return store; };
  await runInsights({ ...s, http: h.client, clock, openHistory }); await runInsights({ ...s, http: h.client, clock, openHistory });
  assert.deepEqual([opened, closed], [2, 2]);
  const broken = await runInsights({ ...s, http: h.client, clock, openHistory: () => { throw new Error('synthetic'); } });
  assert.deepEqual([broken.storage, broken.exitCode, broken.sources.length], ['memory', 0, 4]);
});
test('every source failing is exit 1 (reasons are codes only); injected ports flow through the same run', async t => {
  const s = setup(t), down = await runInsights({ ...s, http: http(503).client, clock, sourceOptions: noWait });
  assert.deepEqual([down.exitCode, down.letter.ok, down.sources.every(r => r.failure === 'fetch' && r.reason === 'unavailable')], [1, false, true]);
  const port: InsightSourcePort = { id: 'arena', fetch: async () => [arenaRow(0), arenaRow(1)], parse: (p, at) => parseArenaRows(p as unknown[], at) };
  const run = await runInsights({ ...s, clock, createPorts: () => [port] });
  assert.deepEqual([run.exitCode, run.sources.map(r => r.status)], [0, ['collected']]);
});
test('insights, usage, Zen and detect connections converge in every opening order (versions 1-5, all tables)', t => {
  const openers = { insights: (e: NodeJS.ProcessEnv) => openInsightsHistory(e).close(), usage: (e: NodeJS.ProcessEnv) => openUsageDatabase(join(e.YOROI_DATA_DIR!, 'yoroi.db')).close(),
    zen: (e: NodeJS.ProcessEnv) => openZenLockStore(e).close(), detect: (e: NodeJS.ProcessEnv) => openDetectStateStore(e).close() };
  const permute = <T,>(items: T[]): T[][] => items.length < 2 ? [items] : items.flatMap((item, i) => permute([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
  for (const order of permute(Object.keys(openers) as (keyof typeof openers)[])) {
    const dir = mkdtempSync(join(tmpdir(), 'yoroi-insights-order-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const name of order) openers[name]({ YOROI_DATA_DIR: dir });
    const db = openDatabase(join(dir, 'yoroi.db'));
    try {
      assert.deepEqual((db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[]).map(r => r.version), [1, 2, 3, 4, 5], order.join());
      const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(r => r.name);
      for (const need of ['insight_daily', 'insight_history', 'cache_entries', 'plugin_loads', 'detect_state']) assert.ok(names.includes(need), `${need} ${order.join()}`);
    } finally { db.close(); }
  }
});
