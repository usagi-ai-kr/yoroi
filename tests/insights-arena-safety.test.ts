import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { fetchArenaRows } from '../src/insights/arena-transport.js';

const rowFor = (rank: unknown, date: unknown = '2026-10-08', extra: Record<string, unknown> = {}) => ({
  model_name: 'synthetic-model', organization: 'synthetic-org', license: 'Proprietary', rating: 1500,
  rating_lower: 1490, rating_upper: 1510, variance: 20, vote_count: 1000, rank, category: 'overall',
  leaderboard_publish_date: date, ...extra });
const ties = (n: number, rank = 20): unknown[] => Array.from({ length: n }, () => rowFor(rank));
const seq = (from: number, to: number): unknown[] => Array.from({ length: to - from + 1 }, (_, i) => rowFor(from + i));
const body = (rows: unknown[], total: number, partial = false): string =>
  JSON.stringify({ features: [], rows: rows.map((row, i) => ({ row_idx: i, row })), num_rows_total: total, num_rows_per_page: 100, partial });
function serve(all: unknown[], total = all.length, patch: Record<string, unknown> = {}) {
  return (request: HttpRequest, n: number): HttpResponse => {
    const offset = Number(new URL(request.url).searchParams.get('offset'));
    return { status: 200, headers: {}, body: JSON.stringify({ ...JSON.parse(body(all.slice(offset, offset + 100), total)), ...patch }) };
  };
}
function fake(respond: (request: HttpRequest, n: number) => HttpResponse | Error) {
  const requests: HttpRequest[] = []; let clock = 1_000_000;
  const client: HttpClient = { async request(request) { requests.push(request); const out = respond(request, requests.length); if (out instanceof Error) throw out; return out; } };
  return { client, requests, options: { now: () => clock, sleep: async () => {} } };
}
const code = (want: string) => (error: unknown) => error instanceof SourceError && error.code === want;

test('a partial page fails as a whole', async () => {
  const f = fake(() => ({ status: 200, headers: {}, body: body([rowFor(1)], 1, true) }));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
test('100 rows tied at rank 20 need a second page; a changed total there fails unavailable', async () => {
  const f = fake((request, n) => n === 1 ? serve(ties(100), 200)(request, n)
    : { status: 200, headers: {}, body: body(seq(21, 30), 201) });
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 2);
});
test('the second page may confirm the boundary after 100 rank-20 ties without collecting more rows', async () => {
  const f = fake((request, n) => n === 1 ? serve(ties(100), 150)(request, n)
    : { status: 200, headers: {}, body: body(seq(21, 50), 150) });
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, result.boundary], [100, 2, 'rank-above-top']);
});
test('mixed publication dates inside the collected top rows fail unavailable', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => rowFor(i + 1, i % 2 ? '2026-10-07' : '2026-10-08')).concat(rowFor(21));
  const f = fake(serve(rows, 500));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
test('an oversized page body fails unavailable before any row is used', async () => {
  const f = fake(() => ({ status: 200, headers: {}, body: body([rowFor(1, '2026-10-08', { blob: 'x'.repeat(300 * 1024) })], 1) }));
  await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
test('bad shapes fail as parse: rows, total, category value', async () => {
  for (const patch of [{ rows: 'x' }, { num_rows_total: 'x' }, { rows: [{ row: { ...rowFor(1), category: 5 } }], num_rows_total: 1 }]) {
    const f = fake(() => ({ status: 200, headers: {}, body: JSON.stringify({ features: [], partial: false, ...patch }) }));
    await assert.rejects(fetchArenaRows(f.client, f.options), code('parse'), JSON.stringify(patch).slice(0, 40));
  }
});
test('cancellation before and after the first page stops without further requests', async () => {
  const pre = new AbortController(); pre.abort();
  const early = fake(serve(seq(1, 100), 500));
  await assert.rejects(fetchArenaRows(early.client, { ...early.options, signal: pre.signal }), code('cancelled'));
  assert.equal(early.requests.length, 0);
  const live = new AbortController();
  const f = fake((request, n) => { if (n === 1) live.abort(); return serve(ties(100), 200)(request, n); });
  await assert.rejects(fetchArenaRows(f.client, { ...f.options, signal: live.signal }), code('cancelled'));
  assert.equal(f.requests.length, 1);
});
test('the 60 second budget stops paging before a second dispatch', async () => {
  const f = fake(serve(ties(100), 10_000));
  let t = 0;
  const timed = { ...f.options, now: () => (t += 40_000) };
  await assert.rejects(fetchArenaRows(f.client, timed), code('unavailable'));
  assert.equal(f.requests.length, 1);
});
