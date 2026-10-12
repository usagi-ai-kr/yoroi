import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { collectInsightSource } from '../src/insights/source-port.js';
import { createInsightSourcePorts, INSIGHT_SOURCES } from '../src/insights/sources.js';

const KEY = 'synthetic-aa-key-must-not-leak', observedAt = '2026-10-11T00:00:00.000Z';
const env = (name: string) => ({ YOROI_AA_API_KEY: KEY, YOROI_OPENROUTER_API_KEY: 'synthetic-or-key' } as Record<string, string>)[name];
const json = (value: unknown, status = 200, headers: Record<string, string> = {}): HttpResponse => ({ status, headers, body: JSON.stringify(value) });
const aaPage = (page: number, total: number, id: string) => ({ tier: 'free', intelligence_index_version: 3, pagination: { page, page_size: 1, total_pages: total, has_more: page < total },
  data: [{ id, slug: id, name: id, release_date: '2025-01-01', model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: 40 + page, artificial_analysis_coding_index: 30 + page }, pricing: {}, performance: {} }] });
const arenaRow = (i: number, category = 'overall') => ({ model_name: `m${i}`, organization: 'o', license: 'L', rating: 1500 - i, rating_lower: 1490, rating_upper: 1510, variance: 2, vote_count: 10 + i, rank: i + 1, category, leaderboard_publish_date: '2026-10-08' });
function harness(respond: (request: HttpRequest, n: number) => HttpResponse) {
  const requests: HttpRequest[] = []; let clock = 1_000_000; const sleeps: number[] = [];
  const client: HttpClient = { async request(request) { requests.push(request); return respond(request, requests.length); } };
  const options = { now: () => clock, sleep: async (ms: number) => { sleeps.push(ms); clock += ms; } };
  const ports = new Map(createInsightSourcePorts(client, env, options).map(p => [p.id, p]));
  return { requests, sleeps, ports, advance: (ms: number) => { clock += ms; } };
}
const of = (url: string, name: string) => new URL(url).searchParams.get(name);

test('the registry holds the four approved ports plus the OpenCode Data internal reference; Vals AI stays excluded', () => {
  assert.deepEqual(INSIGHT_SOURCES.map(e => e.id), ['arena', 'artificial-analysis', 'openrouter', 'opencode-data', 'cognition']);
  assert.deepEqual([...harness(() => json({})).ports.keys()], ['arena', 'artificial-analysis', 'openrouter', 'opencode-data', 'cognition']);
});
test('Arena goes through the /rows transport and the existing parser with no key and no extra headers', async () => {
  const h = harness(request => { const offset = Number(of(request.url, 'offset'));
    const rows = Array.from({ length: 51 }, (_, i) => arenaRow(i)).slice(offset, offset + 100);
    return json({ rows: rows.map(row => ({ row })), num_rows_total: 51, partial: false }); });
  const result = await collectInsightSource(h.ports.get('arena')!, observedAt);
  assert.ok(result.ok && result.rows.length === 50 && result.rows.every(r => r.ok)); assert.equal(h.requests.length, 1);
  assert.ok(h.requests.every(r => r.headers === undefined && of(r.url, 'config') === 'text'));
});
test('AA pages are fetched with the key on every request, merged by H3, and the key never appears in URLs or errors', async () => {
  const h = harness(request => { const page = Number(of(request.url, 'page') ?? 1); return json(aaPage(page, 3, `model-${page}`)); });
  const result = await collectInsightSource(h.ports.get('artificial-analysis')!, observedAt);
  assert.ok(result.ok && result.rows.length === 3 && result.rows.every(r => r.ok));
  assert.deepEqual(h.requests.map(r => of(r.url, 'page')), [null, '2', '3']);
  assert.ok(h.requests.every(r => Object.keys(r.headers ?? {}).join() === 'x-api-key' && !r.url.includes(KEY)));
  const broken = harness(() => json({}, 503)); const failed = await collectInsightSource(broken.ports.get('artificial-analysis')!, observedAt);
  assert.ok(!failed.ok && !JSON.stringify(failed).includes(KEY));
});
test('AA failures: first-page auth stops at one request; a failed later page or the request cap is a source failure, not a partial success', async () => {
  const auth = harness(() => json({}, 401)); const denied = await collectInsightSource(auth.ports.get('artificial-analysis')!, observedAt);
  assert.deepEqual([denied.ok, !denied.ok && denied.error.code, auth.requests.length], [false, 'authentication', 1]);
  const gap = harness(request => { const page = Number(of(request.url, 'page') ?? 1); return page === 3 ? json({}, 503) : json(aaPage(page, 3, `m${page}`)); });
  const partial = await collectInsightSource(gap.ports.get('artificial-analysis')!, observedAt);
  assert.deepEqual([partial.ok, !partial.ok && partial.error.code], [false, 'unavailable']);
  const many = harness(request => json(aaPage(Number(of(request.url, 'page') ?? 1), 30, `m${of(request.url, 'page')}`)));
  const capped = await collectInsightSource(many.ports.get('artificial-analysis')!, observedAt);
  assert.ok(!capped.ok && many.requests.length <= 10);
});
test('OpenRouter and Cognition use the policy path with independent sessions: one retry each, Retry-After honored', async () => {
  const h = harness(() => json({}, 503, { 'retry-after': '3' }));
  const [or, cog] = await Promise.all(['openrouter', 'cognition'].map(id => collectInsightSource(h.ports.get(id as 'openrouter')!, observedAt)));
  assert.ok(!or!.ok && !cog!.ok); assert.equal(h.requests.length, 4); assert.deepEqual(h.sleeps, [1000, 1000]);
  const limited = harness((request, n) => (n === 1 ? json({}, 429, { 'Retry-After': '2' }) : json({ v1_1: { models: ['M'], subsets: { main: 100 }, data: { M: { high: { main: { correct: 0.5, cost: 1 } } } } } })));
  assert.ok((await collectInsightSource(limited.ports.get('cognition')!, observedAt)).ok); assert.deepEqual(limited.sleeps, [2000]);
});
test('sessions share the run start: after the 60 second budget no source sends another request', async () => {
  const h = harness(() => json({})); h.advance(61_000);
  for (const id of ['artificial-analysis', 'openrouter', 'cognition'] as const) {
    const result = await collectInsightSource(h.ports.get(id)!, observedAt); assert.ok(!result.ok && result.error.code === 'unavailable');
  }
  assert.equal(h.requests.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(h.ports.get('openrouter')!.fetch(controller.signal), (e: unknown) => e instanceof SourceError && e.code === 'cancelled');
});
