import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchJson, fetchJsonWithPolicy, type SourceRequestSession } from '../src/insights/fetch-json.js';
import type { HttpClient, HttpRequest, HttpResponse } from '../src/infra/http-client.js';
import { SourceError } from '../src/app/usage-source.js';

const KEY = 'synthetic-key-must-not-leak';
const spec = { url: 'https://synthetic.test/a', timeoutMs: 5_000, headers: { Authorization: `Bearer ${KEY}` } };
const ok = (body = '{}'): HttpResponse => ({ status: 200, headers: {}, body });
const down = { status: 503, headers: {}, body: '{}' };
const code = (want: string) => (e: unknown) => e instanceof SourceError && e.code === want;

/** 가짜 HttpClient(실 네트워크 없음)·가짜 clock·sleep·소스별 세션. */
function fake(responses: readonly (HttpResponse | Error)[]) {
  const requests: HttpRequest[] = []; let i = 0, nowMs = 1_000_000; const sleeps: number[] = [];
  const client: HttpClient = { async request(request) {
    requests.push(request); const next = responses[Math.min(i++, responses.length - 1)]!;
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next); } };
  const sleep = async (ms: number) => { sleeps.push(ms); nowMs += ms; };
  return { client, requests, sleeps, now: () => nowMs, sleep,
    session: (): SourceRequestSession => ({ startedAtMs: 1_000_000, requestsMade: 0, retriesMade: 0 }),
    run: (s: SourceRequestSession, policy = {}, signal?: AbortSignal) =>
      fetchJsonWithPolicy(client, spec, s, { now: () => nowMs, sleep, policy }, signal) };
}

test('one success sends once, never sleeps, and the counter rises before dispatch', async () => {
  const f = fake([ok('{"v":1}')]); const s = f.session();
  assert.deepEqual(await f.run(s), { v: 1 }); assert.equal(f.requests.length, 1);
  assert.equal(s.requestsMade, 1); assert.equal(s.retriesMade, 0); assert.deepEqual(f.sleeps, []);
  assert.equal(f.requests[0]?.timeoutMs, 5_000, 'full budget keeps the spec timeout');
  const g = fake([ok(), ok(), ok()]); const shared = g.session(); const seen: number[] = [];
  for (let i = 0; i < 3; i += 1) { const before = shared.requestsMade; await g.run(shared);
    seen.push(shared.requestsMade - before); }
  assert.deepEqual(seen, [1, 1, 1]); assert.equal(shared.requestsMade, 3, 'the source keeps one state');
  assert.equal(shared.startedAtMs, 1_000_000, 'the execution start anchors the budget'); });

test('429 retries once after Retry-After and then returns the body', async () => {
  const f = fake([{ status: 429, headers: { 'Retry-After': '2' }, body: '{}' }, ok('{"v":2}')]);
  const s = f.session(); assert.deepEqual(await f.run(s), { v: 2 });
  assert.deepEqual(f.sleeps, [2_000], 'Retry-After is honoured');
  assert.equal(s.retriesMade, 1); assert.equal(s.requestsMade, 2); });

test('a 5xx retries once with the policy delay, then gives up', async () => {
  const f = fake([down, down]); const s = f.session();
  await assert.rejects(f.run(s), code('unavailable')); assert.equal(s.retriesMade, 1);
  assert.equal(f.requests.length, 2, 'at most one retry');
  assert.deepEqual(f.sleeps, [1_000], 'policy delay is used when Retry-After is absent'); });

test('401 and a parse failure are terminal and never retried', async () => {
  for (const [response, want] of [[{ status: 401, headers: {}, body: '{}' }, 'authentication'],
    [ok('not json'), 'parse']] as const) { const f = fake([response]);
    await assert.rejects(f.run(f.session()), code(want));
    assert.equal(f.requests.length, 1); assert.deepEqual(f.sleeps, []); } });

test('policy refusals stop before dispatching anything', async () => {
  const huge = fake([{ status: 429, headers: { 'retry-after': '99999' }, body: '{}' }, ok()]);
  await assert.rejects(huge.run(huge.session()), code('unavailable'));
  assert.equal(huge.requests.length, 1, 'budget exhaustion prevents the retry');
  assert.deepEqual(huge.sleeps, []);

  const capped = fake([ok()]); const s = capped.session(); s.requestsMade = 10;
  await assert.rejects(capped.run(s, { maxRequests: 10 }), code('unavailable'));
  assert.equal(capped.requests.length, 0, 'no request leaves past the cap');
  assert.equal(s.requestsMade, 10, 'the counter is not advanced when refused'); });

test('the HTTP timeout is clamped to the remaining budget', async () => {
  const f = fake([down, ok()]); await f.run(f.session(), { budgetMs: 4_000 });
  assert.equal(f.requests[0]?.timeoutMs, 4_000, 'clamped from 5000 to the budget');
  const g = fake([ok()]); await g.run(g.session(), { budgetMs: 900 });
  assert.equal(g.requests[0]?.timeoutMs, 900); });

test('abort stops both the loop and the wait', async () => {
  const controller = new AbortController(); const f = fake([down, ok()]);
  await assert.rejects(fetchJsonWithPolicy(f.client, spec, f.session(),
    { now: f.now, sleep: async () => { controller.abort(); throw new SourceError('cancelled'); } },
    controller.signal), code('cancelled'));
  const g = fake([ok()]); await assert.rejects(g.run(g.session(), {}, AbortSignal.abort()),
    code('cancelled'));
  assert.equal(g.requests.length, 0, 'an aborted signal dispatches nothing'); });

test('keys, headers and bodies never reach an error surface', async () => {
  const leaky = { status: 503, headers: { 'x-key': KEY }, body: `{"token":"${KEY}"}` };
  const f = fake([leaky, leaky]);
  await assert.rejects(f.run(f.session()), (error: unknown) => {
    const text = error instanceof SourceError ? `${error.code} ${error.message}` : String(error);
    assert.ok(!text.includes(KEY) && !text.includes('token') && !text.includes('x-key'), text);
    return error instanceof SourceError && error.code === 'unavailable'; });
  assert.equal(f.requests[0]?.headers?.Authorization, `Bearer ${KEY}`,
    'the credential reaches the client and is only never surfaced'); });

test('the policy-free fetchJson keeps its existing single-shot contract', async () => {
  const f = fake([ok('{"v":3}')]);
  assert.deepEqual(await fetchJson(f.client, spec), { v: 3 });
  assert.equal(f.requests[0]?.timeoutMs, 5_000, 'the legacy path never clamps');
  assert.equal(f.requests[0]?.method, 'GET');
  for (const [status, want] of [[429, 'unavailable'], [503, 'unavailable'],
    [401, 'authentication']] as const) {
    const g = fake([{ status, headers: {}, body: '{}' }]);
    await assert.rejects(fetchJson(g.client, spec), code(want));
    assert.equal(g.requests.length, 1, 'the legacy path never retries'); } });
