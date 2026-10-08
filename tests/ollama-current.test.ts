import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOllamaUsage } from '../src/infra/ollama-parser.js';
import { parseOllamaBalance } from '../src/infra/ollama-balance-parser.js';
import { OllamaSource } from '../src/infra/ollama-source.js';
import { SourceError } from '../src/app/usage-source.js';

const now = '2026-10-08T00:00:00Z';
const usage = { range: '7d', scope: 'self', granularity: 'day', from: '2026-10-01T00:00:00Z',
  until: now, totals: { request_count: 4, usage_usd: 1.25, input_tokens: 100,
    cached_input_tokens: 20, output_tokens: 30 }, buckets: [] };
const balance = { included: { balance_usd: 6, allowance_usd: 10,
  period: { from: '2026-10-01T00:00:00Z', until: '2026-11-01T00:00:00Z' } },
  purchased: { balance_usd: 2 } };
test('current Ollama activity schema preserves units and the actual query range', () => {
  const result = parseOllamaUsage(JSON.stringify(usage), now);
  assert.equal(result.windows.length, 5);
  assert.deepEqual(result.windows[0], { id: 'activity:7d:request_count', unit: 'requests', used: 4 });
  assert.equal(result.windows[1]?.unit, 'USD');
  assert.equal(result.windows[3]?.used, 20);
  assert.ok(result.windows.every(window => window.limit === undefined && window.resetAt === undefined));
});
test('current Ollama included and purchased balances preserve credit renewal and remaining values', () => {
  const result = parseOllamaBalance(JSON.stringify(balance), now);
  assert.deepEqual(result.windows[0], { id: 'credits:included', unit: 'USD', remaining: 6,
    limit: 10, used: 4, percent: 40, resetAt: '2026-11-01T00:00:00Z',
    periodStart: '2026-10-01T00:00:00Z' });
  assert.deepEqual(result.windows[1], { id: 'credits:purchased', unit: 'USD', remaining: 2 });
  for (const limit of [0, 0.00000011]) {
    const parsed = parseOllamaBalance(JSON.stringify({ included: { balance_usd: 0, allowance_usd: limit } }), now);
    assert.equal(parsed.windows[0]?.percent, limit ? 100 : undefined);
  }
  const rollover = parseOllamaBalance('{"included":{"balance_usd":12,"allowance_usd":10}}', now);
  assert.equal(rollover.windows[0]?.used, undefined);
});
test('unsupported totals and malformed balances remain safe parse errors', () => {
  for (const data of [{ ...usage, totals: {} }, { ...usage, range: 'secret/path' },
    { ...usage, totals: { request_count: 'secret' } }, { ...usage, totals: { input_tokens: -1 } }]) {
    assert.throws(() => parseOllamaUsage(JSON.stringify(data), now), new SourceError('parse'));
  }
  for (const data of [{}, { included: {} }, { included: { balance_usd: -1, allowance_usd: 10 } },
    { ...balance, included: { ...balance.included, period: { until: 'secret' } } },
    { ...balance, included: { ...balance.included, period: { from: 'secret' } } }]) {
    assert.throws(() => parseOllamaBalance(JSON.stringify(data), now), new SourceError('parse'));
  }
});
test('current Ollama source signs both read-only routes and combines seven distinct windows', async () => {
  const calls: string[] = [];
  const source = new OllamaSource({ request: async request => {
    calls.push(request.url);
    assert.equal(request.headers?.Authorization, `signed:GET,${new URL(request.url).pathname}${new URL(request.url).search}`);
    return { status: 200, headers: {}, body: JSON.stringify(request.url.includes('/balance') ? balance : usage) };
  } }, async challenge => `signed:${challenge}`, 1000, () => now);
  const result = await source.read();
  assert.equal(result.windows.length, 7);
  assert.deepEqual(calls.map(url => new URL(url).pathname), ['/api/usage', '/api/balance']);
});
