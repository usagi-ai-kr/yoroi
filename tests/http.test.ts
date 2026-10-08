import assert from 'node:assert/strict';
import test from 'node:test';
import { NodeHttpClient } from '../src/infra/http-client.js';

const request = { method: 'GET', url: 'https://example.invalid/usage',
  headers: { Authorization: 'secret' }, timeoutMs: 100 };
test('HTTP preserves response status and body for adapter interpretation', async () => {
  const client = new NodeHttpClient(async () => new Response('{"used":2}', {
    status: 401, headers: { 'content-type': 'application/json' },
  }));
  const response = await client.request(request);
  assert.equal(response.status, 401);
  assert.equal(response.body, '{"used":2}');
  assert.equal(response.headers['content-type'], 'application/json');
});
test('HTTP normalizes network errors without exposing request credentials', async () => {
  const client = new NodeHttpClient(async () => { throw new Error('secret'); });
  await assert.rejects(client.request(request), { code: 'network',
    message: 'Usage query connection failed' });
});
test('HTTP timeout and cancellation abort the request with safe codes', async () => {
  const client = new NodeHttpClient(async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('secret')), { once: true });
  }));
  await assert.rejects(client.request({ ...request, timeoutMs: 5 }), { code: 'timeout' });
  const controller = new AbortController();
  const running = client.request(request, controller.signal);
  controller.abort();
  await assert.rejects(running, { code: 'cancelled' });
  await assert.rejects(client.request(request, controller.signal), { code: 'cancelled' });
});
test('oversize declared body surfaces unavailable instead of being rewritten as network', async () => {
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(16)); } });
  const client = new NodeHttpClient(async () => new Response(stream, {
    headers: { 'content-length': String(2 * 1024 * 1024) } }));
  await assert.rejects(client.request(request), { code: 'unavailable',
    message: 'Usage query is unavailable' });
});
test('chunked body over the limit cancels the reader and stays unavailable', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(256 * 1024)); },
    cancel() { cancelled = true; },
  });
  const client = new NodeHttpClient(async () => new Response(stream));
  await assert.rejects(client.request(request), { code: 'unavailable' });
  assert.equal(cancelled, true);
});
test('timeout during body read cancels the pending reader and stays timeout', async () => {
  let cancelled = false;
  const client = new NodeHttpClient(async () => new Response(new ReadableStream<Uint8Array>({
    cancel() { cancelled = true; },
  })));
  const failure = await client.request({ ...request, timeoutMs: 5 }).catch((error: unknown) => error);
  assert.equal((failure as { code?: string }).code, 'timeout');
  assert.equal((failure as { message?: string }).message, 'Usage query timed out');
  assert.equal(cancelled, true);
});
test('external abort during body read reports cancelled', async () => {
  const controller = new AbortController();
  const client = new NodeHttpClient(async (_url, init) => {
    const stream = new ReadableStream<Uint8Array>({
      start(c) { init?.signal?.addEventListener('abort', () => c.error(new Error('secret')), { once: true }); },
    });
    return new Response(stream);
  });
  const running = client.request(request, controller.signal);
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(running, { code: 'cancelled' });
});
test('settled requests remove abort listeners and clear the timeout timer', async () => {
  const listeners = new Set<() => void>();
  const fakeSignal = { aborted: false,
    addEventListener: (_type: string, handler: () => void) => { listeners.add(handler); },
    removeEventListener: (_type: string, handler: () => void) => { listeners.delete(handler); },
  } as unknown as AbortSignal;
  const client = new NodeHttpClient(async () => new Response('{"used":2}'));
  const originalSet = globalThis.setTimeout;
  const originalClear = globalThis.clearTimeout;
  let timers = 0;
  let cleared = 0;
  globalThis.setTimeout = ((handler: () => void, ms?: number) => {
    timers += 1; return originalSet(handler, ms);
  }) as typeof setTimeout;
  globalThis.clearTimeout = ((id?: NodeJS.Timeout) => {
    cleared += 1; return originalClear(id);
  }) as typeof clearTimeout;
  try { await client.request(request, fakeSignal); }
  finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; }
  assert.equal(listeners.size, 0);
  assert.equal(timers, 1);
  assert.equal(cleared, 1);
});
