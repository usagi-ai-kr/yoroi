import assert from 'node:assert/strict';
import test from 'node:test';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { ARENA_LIMITS, fetchArenaRows, readArena } from '../src/insights/arena-transport.js';

const row = (i: number, category = 'overall', date = '2026-10-08') => ({ model_name: `synthetic-model-${i}`, organization: 'synthetic-org',
  license: 'Proprietary', rating: 1500 - i, rating_lower: 1490 - i, rating_upper: 1510 - i, variance: 20, vote_count: 1000 + i, rank: i + 1,
  category, leaderboard_publish_date: date });
/** Dataset of `overall` rows followed by `other` rows of another category, served 100 per /rows page. */
function dataset(overall: number, other = 0, date = '2026-10-08') {
  const all = [...Array.from({ length: overall }, (_, i) => row(i, 'overall', date)), ...Array.from({ length: other }, (_, i) => row(i, 'coding', date))];
  return (request: HttpRequest): HttpResponse => {
    const url = new URL(request.url), offset = Number(url.searchParams.get('offset')), length = Number(url.searchParams.get('length'));
    const rows = all.slice(offset, offset + length).map((r, i) => ({ row_idx: offset + i, row: r, truncated_cells: [] }));
    return { status: 200, headers: {}, body: JSON.stringify({ features: [], rows, num_rows_total: all.length, num_rows_per_page: 100, partial: false }) };
  };
}
function fake(respond: (request: HttpRequest, n: number) => HttpResponse | Error) {
  const requests: HttpRequest[] = []; let clock = 1_000_000; const sleeps: number[] = [];
  const client: HttpClient = { async request(request) { requests.push(request); const out = respond(request, requests.length); if (out instanceof Error) throw out; return out; } };
  return { client, requests, sleeps, options: { now: () => clock, sleep: async (ms: number) => { sleeps.push(ms); clock += ms; } }, advance: (ms: number) => { clock += ms; } };
}
const code = (want: string) => (e: unknown) => e instanceof SourceError && e.code === want;

test('early stop: overall rows end mid-page, no further request, rows feed the existing Arena parser', async () => {
  const f = fake(dataset(250, 400));
  const result = await fetchArenaRows(f.client, f.options);
  assert.deepEqual([result.rows.length, result.requests, f.requests.length, result.totalRows, result.publishDate], [250, 3, 3, 650, '2026-10-08']);
  const parsed = await readArena(fake(dataset(120, 50)).client, '2026-10-11T00:00:00Z');
  assert.equal(parsed.length, 120); assert.ok(parsed.every(r => r.ok && r.records.length === 6 && r.records[0]!.source === 'arena' && r.records[0]!.sourceAsOf === '2026-10-08'));
});
test('requests are anonymous GETs for dataset, text subset, latest split and 100-row offsets', async () => {
  const f = fake(dataset(150, 10)); await fetchArenaRows(f.client, f.options);
  const urls = f.requests.map(r => new URL(r.url));
  assert.deepEqual(f.requests.map(r => [r.method, r.headers]), [['GET', undefined], ['GET', undefined]]);
  assert.deepEqual(urls.map(u => [u.origin + u.pathname, u.searchParams.get('dataset'), u.searchParams.get('config'), u.searchParams.get('split'), u.searchParams.get('offset'), u.searchParams.get('length')]),
    [0, 100].map(o => ['https://datasets-server.huggingface.co/rows', 'lmarena-ai/leaderboard-dataset', 'text', 'latest', String(o), '100']));
  assert.ok(f.requests.every(r => r.timeoutMs <= ARENA_LIMITS.pageTimeoutMs));
});
test('the dataset end stops paging when overall fills the whole split; a block ending exactly on a page edge costs one more page', async () => {
  const end = fake(dataset(150)); assert.equal((await fetchArenaRows(end.client, end.options)).requests, 2);
  const edge = fake(dataset(200, 5)); assert.deepEqual([(await fetchArenaRows(edge.client, edge.options)).rows.length, edge.requests.length], [200, 3]);
});
test('more than 600 overall rows fails instead of returning a cut-off ranking', async () => {
  const f = fake(dataset(700)); await assert.rejects(fetchArenaRows(f.client, f.options), code('unavailable')); assert.equal(f.requests.length, 7);
  const exact = fake(dataset(600, 50)); assert.equal((await fetchArenaRows(exact.client, exact.options)).rows.length, 600);
});
test('the per-run request cap stops paging; a 429 with Retry-After retries once and a second 429 fails', async () => {
  const capped = fake(dataset(500)); await assert.rejects(fetchArenaRows(capped.client, { ...capped.options, limits: { policy: { maxRequests: 2 } } }), code('unavailable'));
  assert.equal(capped.requests.length, 2);
  const page = dataset(50, 5), limited = fake((r, n) => (n === 1 ? { status: 429, headers: { 'Retry-After': '2' }, body: '{}' } : page(r)));
  assert.equal((await fetchArenaRows(limited.client, limited.options)).rows.length, 50); assert.deepEqual(limited.sleeps, [2000]);
  const twice = fake(() => ({ status: 429, headers: {}, body: '{}' })); await assert.rejects(fetchArenaRows(twice.client, twice.options), code('unavailable'));
  assert.equal(twice.requests.length, 2);
});
test('the 60 second budget stops the run', async () => {
  const page = dataset(500), f = fake((r) => page(r));
  const timed = { ...f.options, now: (() => { let t = 0; return () => (t += 25_000); })() };
  await assert.rejects(fetchArenaRows(f.client, timed), code('unavailable')); assert.ok(f.requests.length <= 3);
});
test('inconsistent or unusable pages fail as a whole: total change, mixed dates, partial, oversize, bad shape, no overall rows', async () => {
  const base = dataset(250, 0), changing = fake((r, n) => { const out = base(r); return n === 2 ? { ...out, body: out.body.replace('"num_rows_total":250', '"num_rows_total":251') } : out; });
  await assert.rejects(fetchArenaRows(changing.client, changing.options), code('unavailable'));
  const mixed = dataset(150, 0), withOldDate = fake((r, n) => { const out = mixed(r); return n === 2 ? { ...out, body: out.body.replaceAll('2026-10-08', '2026-10-07') } : out; });
  await assert.rejects(fetchArenaRows(withOldDate.client, withOldDate.options), code('unavailable'));
  for (const [patch, want] of [[{ partial: true }, 'unavailable'], [{ rows: 'x' }, 'parse'], [{ num_rows_total: 'x' }, 'parse'], [{ rows: [{ row: { ...row(0), category: 5 } }] }, 'parse'],
    [{ rows: [{ row: row(0, 'coding') }], num_rows_total: 1 }, 'parse'], [{ rows: [{ row: { ...row(0), model_name: 'x'.repeat(300 * 1024) } }], num_rows_total: 1 }, 'unavailable']] as const) {
    const f = fake(() => ({ status: 200, headers: {}, body: JSON.stringify({ rows: [row(0)], num_rows_total: 1, partial: false, ...patch }) }));
    await assert.rejects(fetchArenaRows(f.client, f.options), code(want), JSON.stringify(patch).slice(0, 40));
  }
});
test('cancellation before and during paging stops without further requests; errors never expose the URL or values', async () => {
  const done = new AbortController(); done.abort(); const pre = fake(dataset(10));
  await assert.rejects(fetchArenaRows(pre.client, { ...pre.options, signal: done.signal }), code('cancelled')); assert.equal(pre.requests.length, 0);
  const live = new AbortController(), page = dataset(500), f = fake((r, n) => { if (n === 2) live.abort(); return page(r); });
  await assert.rejects(fetchArenaRows(f.client, { ...f.options, signal: live.signal }), code('cancelled')); assert.equal(f.requests.length, 2);
  const broken = fake(() => new SourceError('network')); const error = await fetchArenaRows(broken.client, broken.options).catch((e: Error) => e);
  assert.ok(error instanceof SourceError && !error.message.includes('huggingface') && !error.message.includes('lmarena'));
});
