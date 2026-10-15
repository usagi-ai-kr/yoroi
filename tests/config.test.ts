import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig } from '../src/config/load-config.js';
import { defaultProviders, providers } from '../src/domain/usage.js';

test('configuration defaults to all 6 providers with executable/timeout overrides', () => {
  const config = loadConfig({ YOROI_CODEX_PATH: '/custom/codex', YOROI_CODEX_TIMEOUT_MS: '5000' });
  assert.deepEqual(config.providers.map(p => p.id), [...defaultProviders]);
  assert.equal(config.providers.length, 6);
  const codex = config.providers.find(p => p.id === 'codex');
  assert.deepEqual(codex, { id: 'codex', executable: '/custom/codex', timeoutMs: 5000 });
  const xaiConfig = loadConfig({ YOROI_PROVIDERS: 'xai' });
  assert.deepEqual(xaiConfig.providers.map(p => p.id), ['xai']);
});
test('configuration enables explicit providers and rejects invalid settings', () => {
  const config = loadConfig({ YOROI_PROVIDERS: 'claude,ollama-pro',
    YOROI_OLLAMA_PRO_SIGNING_KEY_PATH: '/custom/key' });
  assert.equal(config.providers.length, 2);
  assert.equal(config.providers[1]?.signingKeyPath, '/custom/key');
  for (const env of [
    { YOROI_PROVIDERS: '' }, { YOROI_PROVIDERS: 'codex,codex' },
    { YOROI_PROVIDERS: 'secret' }, { YOROI_TIMEOUT_MS: 'secret' },
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

test('Claude explicit OAuth overrides CLI OAuth; config directory and home retain their scope', () => {
  const config = loadConfig({ YOROI_PROVIDERS: 'claude', HOME: '/fake/home',
    CLAUDE_CONFIG_DIR: '/fake/config', YOROI_CLAUDE_OAUTH_TOKEN: 'explicit-test-token',
    CLAUDE_CODE_OAUTH_TOKEN: 'cli-test-token', ANTHROPIC_API_KEY: 'unsupported-api-key' });
  assert.equal(config.providers[0]?.oauthToken, 'explicit-test-token');
  assert.equal(config.providers[0]?.configDir, '/fake/config');
  assert.equal(config.providers[0]?.home, '/fake/home');
  assert.equal(loadConfig({ YOROI_PROVIDERS: 'claude', CLAUDE_CODE_OAUTH_TOKEN: 'cli-test-token' })
    .providers[0]?.oauthToken, 'cli-test-token');
  assert.equal(loadConfig({ YOROI_PROVIDERS: 'claude', YOROI_CLAUDE_OAUTH_TOKEN: '',
    CLAUDE_CODE_OAUTH_TOKEN: 'cli-test-token' }).providers[0]?.oauthToken, '');
  assert.equal(loadConfig({ YOROI_PROVIDERS: 'claude', ANTHROPIC_API_KEY: 'unsupported-api-key' })
    .providers[0]?.oauthToken, undefined);
});
