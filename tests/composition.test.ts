import assert from 'node:assert/strict';
import test from 'node:test';
import { createSources } from '../src/composition/sources.js';
import { loadConfig } from '../src/config/load-config.js';
import type { UsageSource } from '../src/app/usage-source.js';
import { createSnapshot } from '../src/domain/usage.js';
import { AgySource } from '../src/infra/agy-source.js';
import { ClaudeSource } from '../src/infra/claude-source.js';
import { CodexSource } from '../src/infra/codex-source.js';
import { OllamaSource } from '../src/infra/ollama-source.js';
import { OpenCodeGoSource } from '../src/infra/opencode-go-source.js';

test('composition instantiates enabled providers only and preserves configured order', () => {
  const calls: string[] = [];
  const codex: UsageSource = { provider: 'codex', read: async () =>
    createSnapshot('codex', '2026-10-07T00:00:00Z', []) };
  const sources = createSources(loadConfig({ YOROI_PROVIDERS: 'codex' }), {
    codex: settings => { calls.push(settings.id); return codex; },
    claude: () => { assert.fail('disabled provider must not be constructed'); },
  });
  assert.deepEqual(calls, ['codex']);
  assert.equal(sources[0], codex);
});
test('an omitted custom factory yields unavailable without external calls', async () => {
  const sources = createSources(loadConfig({ YOROI_PROVIDERS: 'claude,codex' }), {});
  assert.deepEqual(sources.map(source => source.provider), ['claude', 'codex']);
  await assert.rejects(sources[0]!.read(), { code: 'unavailable' });
});
test('the production registry constructs all five actual adapters without making requests', () => {
  const sources = createSources(loadConfig({}));
  assert.equal(sources.length, 5);
  assert.ok(sources[0] instanceof OllamaSource);
  assert.ok(sources[1] instanceof OpenCodeGoSource);
  assert.ok(sources[2] instanceof CodexSource);
  assert.ok(sources[3] instanceof AgySource);
  assert.ok(sources[4] instanceof ClaudeSource);
});
