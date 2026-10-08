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
