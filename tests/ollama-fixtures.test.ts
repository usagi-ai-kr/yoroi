import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseOllamaUsage } from '../src/infra/ollama-parser.js';
import { parseOllamaBalance } from '../src/infra/ollama-balance-parser.js';
import { SourceError } from '../src/app/usage-source.js';

const observedAt = '2026-10-08T00:00:00Z';
const fixture = (name: string) =>
  readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('synthetic fixtures cover legacy limits, current activity, balance and error bodies', async () => {
  const limits = parseOllamaUsage(await fixture('ollama-usage-limits.json'), observedAt);
  assert.deepEqual(limits.windows.map(window => [window.id, window.percent ?? window.used]), [
    ['session', 34.9], ['weekly', 31.6], ['monthly', 5.3], ['activity:last-4-weeks', 1.25],
  ]);
  assert.ok(limits.windows.every(window => window.resetAt === undefined));

  const current = parseOllamaUsage(await fixture('ollama-usage-current.json'), observedAt);
  assert.deepEqual(current.windows.map(window => window.id), [
    'activity:7d:request_count', 'activity:7d:usage_usd', 'activity:7d:input_tokens',
    'activity:7d:cached_input_tokens', 'activity:7d:output_tokens',
  ]);

  const balance = parseOllamaBalance(await fixture('ollama-balance.json'), observedAt);
  assert.deepEqual(balance.windows.map(window => window.id), ['credits:included', 'credits:purchased']);
  assert.equal(balance.windows[0]?.resetAt, '2026-11-01T00:00:00Z');
  assert.equal(balance.windows[0]?.periodStart, '2026-10-01T00:00:00Z');

  const errorBody = await fixture('ollama-error.json');
  for (const parse of [parseOllamaUsage, parseOllamaBalance]) {
    assert.throws(() => parse(errorBody, observedAt), (error: unknown) =>
      error instanceof SourceError && error.code === 'parse' && !error.message.includes('synthetic'));
  }
});
