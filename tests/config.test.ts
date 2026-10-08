import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config/load-config.js';
import { providers } from '../src/domain/usage.js';

test('configuration defaults to all 5 providers and 60 seconds, with executable/timeout overrides', () => {
  const config = loadConfig({ YOROI_CODEX_PATH: '/custom/codex', YOROI_CODEX_TIMEOUT_MS: '5000' });
  assert.equal(config.intervalMs, 60000);
  assert.deepEqual(config.providers.map(p => p.id), [...providers]);
  const codex = config.providers.find(p => p.id === 'codex');
  assert.deepEqual(codex, { id: 'codex', executable: '/custom/codex', timeoutMs: 5000 });
});
test('configuration enables explicit providers and rejects invalid settings', () => {
  const config = loadConfig({ YOROI_PROVIDERS: 'claude,ollama-pro',
    YOROI_OLLAMA_PRO_SIGNING_KEY_PATH: '/custom/key', YOROI_INTERVAL_SECONDS: '30' });
  assert.equal(config.providers.length, 2);
  assert.equal(config.providers[1]?.signingKeyPath, '/custom/key');
  assert.equal(config.intervalMs, 30000);
  for (const env of [
    { YOROI_PROVIDERS: '' }, { YOROI_PROVIDERS: 'codex,codex' },
    { YOROI_PROVIDERS: 'secret' }, { YOROI_TIMEOUT_MS: 'secret' },
    { YOROI_INTERVAL_SECONDS: '0' }, { YOROI_INTERVAL_SECONDS: '86401' },
    { YOROI_CODEX_PATH: ' ' },
  ]) {
    assert.throws(() => loadConfig(env), error =>
      error instanceof Error && !error.message.includes('secret'));
  }
});
test('Ollama uses signing key path when present and credentials remain optional', () => {
  const config = loadConfig({ YOROI_PROVIDERS: 'ollama-pro,opencode-go', HOME: '/execution-account',
    YOROI_OPENCODE_GO_API_KEY: 'fake' });
  assert.equal(config.providers[0]?.signingKeyPath, '/execution-account/.ollama/id_ed25519');
  assert.equal(config.providers[1]?.apiKey, 'fake');
  const withoutCreds = loadConfig({ YOROI_PROVIDERS: 'ollama-pro,opencode-go', HOME: '' });
  assert.equal(withoutCreds.providers[0]?.signingKeyPath, undefined);
  assert.equal(withoutCreds.providers[1]?.apiKey, undefined);
});
