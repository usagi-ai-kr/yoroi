import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseOpenCodeDiscovery, parseOpenRouterDiscovery, parseOllamaDiscovery,
  OPENROUTER_ADAPTER, OLLAMA_ADAPTER, OPENCODE_ADAPTER,
} from '../src/insights/model-discovery-adapters.js';
import { isValidModelId } from '../src/insights/model-discovery-eligibility.js';

const DATE = '2026-10-20';

test('1. OpenCode provider mapping with planIds and free flag', () => {
  const models = parseOpenCodeDiscovery('opencode/zen-free\nopencode-go/gemini-2-5-free\n', DATE);
  assert.equal(models.length, 2);
  assert.deepEqual([models[0]?.modelId, models[0]?.free], ['zen', true]);
  assert.deepEqual(models[0]?.planIds, ['opencode-zen-free']);
  assert.deepEqual([models[1]?.modelId, models[1]?.free], ['gemini-2-5', true]);
  assert.deepEqual(models[1]?.planIds, ['opencode-go-free']);
});

test('2. OpenRouter provider mapping normalizes slash to colon and leaves efforts absent', () => {
  const payload = { data: [{ id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' }] };
  const models = parseOpenRouterDiscovery(payload, DATE);
  assert.equal(models.length, 1);
  assert.equal(models[0]?.modelId, 'openai:gpt-4o');
  assert.ok(isValidModelId(models[0]!.modelId));
  assert.equal(models[0]?.displayName, 'OpenAI: GPT-4o');
  assert.equal(models[0]?.sourceUrl, 'https://openrouter.ai/models');
  assert.deepEqual(models[0]?.planIds, []);
  assert.equal(models[0]?.efforts, undefined);
});

test('3. Ollama local provider mapping leaves efforts absent', () => {
  const models = parseOllamaDiscovery({ models: [{ name: 'llama3.2:3b' }] }, DATE);
  assert.equal(models.length, 1);
  assert.equal(models[0]?.modelId, 'llama3.2:3b');
  assert.ok(isValidModelId(models[0]!.modelId));
  assert.equal(models[0]?.efforts, undefined);
});

test('4. verified defaults to false and is never auto-promoted', () => {
  const m1 = parseOpenRouterDiscovery({ data: [{ id: 'google/gemini-pro' }] }, DATE);
  assert.equal(m1[0]?.verified, false);
  const m2 = parseOpenRouterDiscovery({ data: [{ id: 'google/gemini-pro' }] }, DATE, true);
  assert.equal(m2[0]?.verified, true);
});

test('5. malformed rows are dropped cleanly', () => {
  const badOr = parseOpenRouterDiscovery({ data: [null, {}, { id: '' }, { id: 'valid/model' }] }, DATE);
  assert.deepEqual(badOr.map(m => m.modelId), ['valid:model']);
  const badOllama = parseOllamaDiscovery({ models: [null, { name: '' }, { name: 'valid:tag' }] }, DATE);
  assert.deepEqual(badOllama.map(m => m.modelId), ['valid:tag']);
  assert.deepEqual(parseOpenCodeDiscovery('', DATE), []);
});

test('6. similar names with slash are normalized to colon and not merged', () => {
  const models = parseOpenRouterDiscovery({ data: [{ id: 'muse/spark-1.3' }, { id: 'muse/spark-open' }] }, DATE);
  assert.deepEqual(models.map(m => m.modelId), ['muse:spark-1.3', 'muse:spark-open']);
  assert.ok(isValidModelId(models[0]!.modelId) && isValidModelId(models[1]!.modelId));
});

test('7. deterministic repeat across runs', () => {
  const payload = { data: [{ id: 'm1' }, { id: 'm2' }] };
  assert.deepEqual(parseOpenRouterDiscovery(payload, DATE), parseOpenRouterDiscovery(payload, DATE));
});

test('8. adapter discover via injected context and no-fetcher returns empty array', async () => {
  assert.deepEqual(await OPENROUTER_ADAPTER.discover({ checkedOn: DATE }), []);
  assert.deepEqual(await OLLAMA_ADAPTER.discover({ checkedOn: DATE }), []);
  assert.deepEqual(await OPENCODE_ADAPTER.discover({ checkedOn: DATE }), []);

  const orRes = await OPENROUTER_ADAPTER.discover({ checkedOn: DATE, fetchJson: async () => ({ data: [{ id: 'test/m' }] }) });
  assert.deepEqual(orRes.map(m => m.modelId), ['test:m']);
  const olRes = await OLLAMA_ADAPTER.discover({ checkedOn: DATE, fetchJson: async () => ({ models: [{ name: 'test:ol' }] }) });
  assert.deepEqual(olRes.map(m => m.modelId), ['test:ol']);
  const ocRes = await OPENCODE_ADAPTER.discover({ checkedOn: DATE, runCommand: async () => 'opencode/t-free\n' });
  assert.deepEqual(ocRes.map(m => m.modelId), ['t']);
});
