import assert from 'node:assert/strict';
import test from 'node:test';
import { OllamaSource } from '../src/infra/ollama-source.js';
import { parseOllamaUsage } from '../src/infra/ollama-parser.js';
import { SourceError } from '../src/app/usage-source.js';
import type { HttpRequest } from '../src/infra/http-client.js';

const now = '2026-10-07T00:00:00Z';
const body = JSON.stringify({ limits: { session: { usage: 0.349 }, weekly: { usage: 0.316 },
  monthly: { usage: 0.053 } }, activity: { cost: '1.25000' } });
test('Ollama maps fractions, optional limits and actual spend without inventing reset times', () => {
  const result = parseOllamaUsage(body, now);
  assert.deepEqual(result.windows.map(w => w.percent ?? w.used), [34.9, 31.6, 5.3, 1.25]);
  assert.ok(result.windows.every(w => w.resetAt === undefined));
  assert.equal(parseOllamaUsage('{"limits":{"monthly":{"usage":0}}}', now).windows.length, 1);
  assert.equal(parseOllamaUsage('{"limits":{}}', now).windows.length, 0);
  for (const invalid of ['{}', 'secret', '{"limits":[]}', '{"limits":{"session":{"usage":2}}}',
    '{"limits":{"session":{"usage":"secret"}}}', '{"limits":{},"activity":{"cost":"secret"}}']) {
    assert.throws(() => parseOllamaUsage(invalid, now), new SourceError('parse'));
  }
});
test('Ollama signs the exact timestamped request URI and passes cancellation/timeout', async () => {
  let seen: HttpRequest | undefined;
  const controller = new AbortController();
  const source = new OllamaSource({ request: async request => {
    seen = request;
    return { status: 200, headers: {}, body };
  } }, async challenge => {
    assert.equal(challenge, `GET,/api/usage?ts=${Date.parse(now) / 1000}`);
    return 'public:signature';
  }, 4321, () => now);
  assert.equal((await source.read(controller.signal)).provider, 'ollama-pro');
  assert.equal(seen?.headers?.Authorization, 'public:signature');
  assert.equal(seen?.timeoutMs, 4321);
  assert.equal(seen?.url, `https://ollama.com/api/usage?ts=${Date.parse(now) / 1000}`);
  // The request signal is a deadline-scoped composite, so assert propagation, not identity.
  let pending: AbortSignal | undefined;
  const parent = new AbortController();
  const cancelled = new OllamaSource({ request: (_request, signal) => {
    pending = signal;
    setTimeout(() => parent.abort(), 5);
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new SourceError('cancelled')), { once: true });
    });
  } }, async () => 'key', 5000, () => now);
  await assert.rejects(cancelled.read(parent.signal), new SourceError('cancelled'));
  assert.equal(pending?.aborted, true, 'parent abort must reach the request signal');
  // The same signal cancels the request at the deadline, yet still reports a timeout.
  const deadline = new OllamaSource({ request: (_request, signal) =>
    new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new SourceError('cancelled')), { once: true });
    }) }, async () => 'key', 50, () => now);
  await assert.rejects(deadline.read(), new SourceError('timeout'));
});
test('Ollama normalizes status and transport failures without exposing credentials/body', async () => {
  for (const status of [401, 403, 429, 500]) {
    const source = new OllamaSource({ request: async () => ({ status, headers: {}, body: 'secret' }) },
      async () => 'secret', 1000, () => now);
    await assert.rejects(source.read(), new SourceError(status < 429 ? 'authentication' : 'unavailable'));
  }
  for (const code of ['network', 'timeout', 'cancelled'] as const) {
    const source = new OllamaSource({ request: async () => { throw new SourceError(code); } }, async () => 'key');
    await assert.rejects(source.read(), new SourceError(code));
  }
});
