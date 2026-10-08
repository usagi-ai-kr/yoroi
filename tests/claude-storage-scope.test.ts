import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { claudeAuthorization } from '../src/infra/claude-credentials.js';
import { loadConfig } from '../src/config/load-config.js';

test('macOS secure storage override uses the OS account and NFC hash without reading another profile', async () => {
  const dir = '/fake/cafe\u0301';
  const expected = createHash('sha256').update('/fake/caf\u00e9').digest('hex').slice(0, 8);
  const settings = loadConfig({ YOROI_PROVIDERS: 'claude',
    CLAUDE_CONFIG_DIR: '/fake/other', CLAUDE_SECURESTORAGE_CONFIG_DIR: dir }).providers[0]!;
  let args: readonly string[] | undefined;
  const auth = claudeAuthorization({ ...settings, platform: 'darwin', account: 'fake-user' }, {
    run: async request => {
      args = request.args;
      return { stdout: JSON.stringify({ claudeAiOauth: {
        accessToken: 'synthetic-token', expiresAt: 4102444800000,
      } }), stderr: '', exitCode: 0 };
    },
  });
  assert.equal(await auth(), 'synthetic-token');
  assert.deepEqual(args, ['find-generic-password', '-a', 'fake-user', '-s',
    `Claude Code-credentials-${expected}`, '-w']);
});

test('empty secure storage override prevents a default keychain lookup', async () => {
  const auth = claudeAuthorization({ platform: 'darwin', secureStorageConfigDir: '' }, {
    run: async () => assert.fail('no fallback to another keychain profile'),
  });
  await assert.rejects(auth(), { code: 'authentication' });
});
