import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { fetchArenaRows, readArena } from '../src/insights/arena-transport.js';

const rowFor = (rank: unknown, category = 'overall') => ({ model_name: `synthetic-model-${String(rank)}`, organization: 'synthetic-org',
  license: 'Proprietary', rating: 1500, rating_lower: 1490, rating_upper: 1510, variance: 20, vote_count: 1000,
  rank, category, leaderboard_publish_date: '2026-10-08' });
const ranks = (list: unknown[]): unknown[] => list.map(rank => rowFor(rank));
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

test('one page: collect ranks 1..50 and stop at the same page rank-51 boundary', async () => {
  const f = fake(serve(seq(1, 100), 500));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, f.requests.length, result.boundary, result.totalRows, result.publishDate],
    [50, 1, 1, 'rank-above-top', 500, '2026-10-08']);
  const parsed = await readArena(fake(serve(seq(1, 100))).client, '2026-10-11T00:00:00Z');
  assert.equal(parsed.length, 50); assert.ok(parsed.every(row => row.ok && row.records.length === 6));
  const url = new URL(f.requests[0]!.url);
  assert.deepEqual([f.requests[0]!.method, f.requests[0]!.headers, url.searchParams.get('config'), url.searchParams.get('split'), url.searchParams.get('length')],
    ['GET', undefined, 'text', 'latest', '100']);
});
test('ties at rank 50 are all collected; the following rank 51 still confirms the boundary', async () => {
  const all = [...seq(1, 49), rowFor(50), rowFor(50), ...seq(51, 100)];
  const f = fake(serve(all));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, result.boundary], [51, 1, 'rank-above-top']);
});
test('a non-overall row ends the overall block and confirms the boundary with fewer than 20 rows', async () => {
  const all = [...seq(1, 5), rowFor(1, 'coding'), rowFor(2, 'coding')];
  const f = fake(serve(all));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, result.boundary], [5, 1, 'category-change']);
});
test('rank inversion or an invalid rank fails the page as unavailable', async () => {
  const inversion = fake(serve(ranks([1, 3, 2, 4])));
  await assert.rejects(fetchArenaRows(inversion.client, inversion.options), code('unavailable'));
  assert.equal(inversion.requests.length, 1);
  for (const bad of [0, -1, 1.5, 'x', undefined]) {
    const f = fake(serve(ranks([1, bad, 3])));
    await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'), String(bad));
  }
});
test('a first row above the top N leaves no overall rows and fails as parse', async () => {
  const f = fake(serve(seq(51, 150)));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('parse'));
});
test('no boundary inside the first page ends unavailable; the retry budget is used only for the 429', async () => {
  const tiePage = serve(ranks(Array.from({ length: 100 }, () => 1)), 10_974);
  const f = fake((request, n) => n === 1 ? { status: 429, headers: { 'Retry-After': '2' }, body: '{}' } : tiePage(request));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.deepEqual([f.requests.length, f.sleeps], [2, [2000]]);
});
test('one 429 retry is allowed inside the budget and then the single page succeeds', async () => {
  const page = serve(seq(1, 100));
  const f = fake((request, n) => n === 1 ? { status: 429, headers: { 'Retry-After': '1' }, body: '{}' } : page(request));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, f.sleeps], [50, 2, [1000]]);
});
test('the whole received block is rank-validated after the boundary; nothing beyond rank 50 is collected', async () => {
  const f = fake(serve([...seq(1, 50), ...seq(51, 100)]));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, result.boundary], [50, 1, 'rank-above-top']);
});
test('an inversion after the boundary row fails as unavailable without another request', async () => {
  const f = fake(serve([...seq(1, 50), rowFor(51), rowFor(50), rowFor(52)]));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
test('an invalid rank after the boundary row fails as unavailable without another request', async () => {
  const f = fake(serve([...seq(1, 50), rowFor(51), rowFor('x')]));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
