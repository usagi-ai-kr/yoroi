import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaSource } from '../src/infra/ollama-source.js';
import { SourceError } from '../src/app/usage-source.js';
import { NodeHttpClient, type HttpClient, type HttpRequest } from '../src/infra/http-client.js';
const now = '2026-10-08T00:00:00Z';
const period = { from: '2026-10-01T00:00:00Z', until: '2026-11-01T00:00:00Z' };
const usageBody = JSON.stringify({ range: '7d', scope: 'self', granularity: 'day', ...period,
  until: now, totals: { request_count: 4, usage_usd: 1.25, input_tokens: 100,
    cached_input_tokens: 20, output_tokens: 30 }, buckets: [] });
const balanceBody = JSON.stringify({ included: { balance_usd: 6, allowance_usd: 10, period },
  purchased: { balance_usd: 2 } });
const noActivity = JSON.stringify({ limits: { weekly: { usage: 0.316 } } });
const sign = async () => 'signed:stub';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const routes = (seen: readonly HttpRequest[]) => seen.map(r => new URL(r.url).pathname);
/** Fake client that never touches the network: each call waits `delays[i]` milliseconds. */
function fake(delays: readonly number[], seen: HttpRequest[] = [], body = usageBody): HttpClient {
  let index = 0;
  return { request: async (request, _signal) => {
    seen.push(request);
    await sleep(delays[Math.min(index++, delays.length - 1)] ?? 0);
    return { status: 200, headers: {}, body: request.url.includes('/balance') ? balanceBody : body };
  } };
}
const at = (delays: number[], seen: HttpRequest[], ms: number, body?: string) =>
  new OllamaSource(fake(delays, seen, body), sign, ms, () => now);
test('the whole usage -> balance pair is bounded by one timeout, not two', async () => {
  const seen: HttpRequest[] = [];
  const started = Date.now();
  await assert.rejects(at([500, 500], seen, 120).read(), new SourceError('timeout'));
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 400, `expected one 120ms deadline, waited ${elapsed}ms`);
  assert.deepEqual(routes(seen), ['/api/usage']);
  assert.equal(seen[0]?.timeoutMs, 120);
});
test('the balance call inherits only the remainder, and an exhausted budget issues no request', async () => {
  const seen: HttpRequest[] = [];
  const started = Date.now();
  await assert.rejects(at([80, 5000], seen, 400).read(), new SourceError('timeout'));
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 700, `expected one 400ms deadline, waited ${elapsed}ms`);
  assert.deepEqual(routes(seen), ['/api/usage', '/api/balance']);
  assert.ok((seen[1]?.timeoutMs ?? 0) > 0 && (seen[1]?.timeoutMs ?? 0) <= 320,
    `balance budget must be the remainder, got ${seen[1]?.timeoutMs}`);
  // The usage call itself consumed the whole budget, so nothing remains for /api/balance.
  const spent: HttpRequest[] = [];
  await assert.rejects(at([260, 0], spent, 100).read(), new SourceError('timeout'));
  assert.deepEqual(routes(spent), ['/api/usage']);
  assert.equal(spent[0]?.timeoutMs, 100);
});
test('the signal handed to the in-flight request aborts once the deadline expires', async () => {
  // Defect 5: the composite scope must reach the request itself, so no HTTP work outlives
  // the read. Both the real client and a fake client must observe the abort.
  let pending: AbortSignal | undefined;
  let fetchAborted = false;
  const fetcher = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => { fetchAborted = true; reject(new Error('x')); }, { once: true });
  })) as unknown as typeof fetch;
  await assert.rejects(new OllamaSource(new NodeHttpClient(fetcher), sign, 60, () => now).read(), new SourceError('timeout'));
  await sleep(30); // the client timer settles in the same timer phase as the rejection
  assert.equal(fetchAborted, true, 'the real client must cancel the in-flight request');
  const source = new OllamaSource({ request: (_request, signal) => {
    pending = signal;
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new SourceError('cancelled')), { once: true });
    });
  } }, sign, 60, () => now);
  await assert.rejects(source.read(), new SourceError('timeout'));
  assert.equal(pending?.aborted, true, 'the in-flight request signal must be aborted after expiry');
});
test('a fast pair returns both window sets, and no activity window skips the balance call', async () => {
  const seen: HttpRequest[] = [];
  const result = await at([5, 5], seen, 5000).read();
  assert.equal(result.provider, 'ollama-pro');
  assert.equal(result.windows.length, 7);
  assert.deepEqual(routes(seen), ['/api/usage', '/api/balance']);
  const plain: HttpRequest[] = [];
  const single = await at([0, 0], plain, 5000, noActivity).read();
  assert.deepEqual(routes(plain), ['/api/usage']);
  assert.equal(single.windows.length, 1);
});
test('parent cancellation reaches the client, reports cancelled, and pre-abort issues nothing', async () => {
  const controller = new AbortController();
  let seenSignal: AbortSignal | undefined;
  const source = new OllamaSource({ request: async (_request, signal) => {
    seenSignal = signal;
    setTimeout(() => controller.abort(), 10);
    await sleep(500);
    return { status: 200, headers: {}, body: usageBody };
  } }, sign, 5000, () => now);
  await assert.rejects(source.read(controller.signal), new SourceError('cancelled'));
  assert.ok(seenSignal, 'the request must receive a signal');
  assert.equal(seenSignal?.aborted, true, 'parent cancellation must reach the in-flight request');
  const requests: HttpRequest[] = [];
  const pre = new AbortController();
  pre.abort();
  await assert.rejects(at([0, 0], requests, 5000).read(pre.signal), new SourceError('cancelled'));
  assert.deepEqual(requests, []);
});
