import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { ARENA_LIMITS, ARENA_TOP_N, fetchArenaRows } from '../src/insights/arena-transport.js';
import { fetchArena } from '../src/insights/sources-arena.js';

const rowFor = (rank: unknown, category = 'overall') => ({ model_name: `synthetic-model-${String(rank)}`, organization: 'synthetic-org',
  license: 'Proprietary', rating: 1500, rating_lower: 1490, rating_upper: 1510, variance: 20, vote_count: 1000,
  rank, category, leaderboard_publish_date: '2026-10-08' });
const seq = (from: number, to: number): unknown[] => Array.from({ length: to - from + 1 }, (_, i) => rowFor(from + i));
function serve(all: unknown[], total = all.length) {
  return (request: HttpRequest): HttpResponse => {
    const url = new URL(request.url), offset = Number(url.searchParams.get('offset')), length = Number(url.searchParams.get('length'));
    return { status: 200, headers: {}, body: JSON.stringify({ features: [],
      rows: all.slice(offset, offset + length).map((row, i) => ({ row_idx: offset + i, row })), num_rows_total: total, num_rows_per_page: 100, partial: false }) };
  };
}
function fake(respond: (request: HttpRequest, n: number) => HttpResponse | Error) {
  const requests: HttpRequest[] = []; let clock = 1_000_000; const sleeps: number[] = [];
  const client: HttpClient = { async request(request) { requests.push(request); const out = respond(request, requests.length); if (out instanceof Error) throw out; return out; } };
  return { client, requests, sleeps, options: { now: () => clock, sleep: async (ms: number) => { sleeps.push(ms); clock += ms; } } };
}
const code = (want: string) => (error: unknown) => error instanceof SourceError && error.code === want;

test('defaults are top50 with a 2-request policy; the source wrapper needs no override', async () => {
  assert.deepEqual([ARENA_TOP_N, ARENA_LIMITS.topN, ARENA_LIMITS.policy.maxRequests], [50, 50, 2]);
  const f = fake(serve(seq(1, 100), 500));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, result.boundary], [50, 1, 'rank-above-top']);
  const g = fake(serve(seq(1, 100), 500));
  const rows = await fetchArena(g.client, g.options);
  assert.deepEqual([rows.length, g.requests.length], [50, 1]);
});
test('600/601 boundary intent superseded: a 601-row overall block stops at rank 51 after one request', async () => {
  const f = fake(serve(seq(1, 601)));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, f.requests.length, result.boundary], [50, 1, 'rank-above-top']);
});
test('the dataset total (10974) stays separate from the collected top rows', async () => {
  const f = fake(serve(seq(1, 100), 10_974));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.totalRows, result.requests], [50, 10_974, 1]);
});
test('the collected top rows feed the existing parser (50 rows, 6 metrics each)', async () => {
  const f = fake(serve(seq(1, 100), 500));
  const parsed = await (await import('../src/insights/arena-transport.js')).readArena(f.client, '2026-10-11T00:00:00Z');
  assert.equal(parsed.length, 50);
  assert.ok(parsed.every(row => row.ok && row.records.length === 6 && row.records[0]!.source === 'arena'
    && row.records[0]!.sourceAsOf === '2026-10-08'));
});
test('two retryable failures exhaust the 2-request budget without a third dispatch', async () => {
  const f = fake(() => ({ status: 500, headers: {}, body: '{}' }));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 2); assert.equal(f.sleeps.length, 1);
});
test('a dataset that ends at rank 50 fails unavailable because no boundary confirmed the block', async () => {
  const f = fake(serve(seq(1, 50), 50));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
