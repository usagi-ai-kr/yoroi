import assert from 'node:assert/strict';
import test from 'node:test';
import { claudeAuthorization } from '../src/infra/claude-credentials.js';

test('expired Keychain OAuth falls back to a valid file in the same execution profile', async () => {
  let path: string | undefined;
  const auth = claudeAuthorization({ platform: 'darwin', home: '/fake/home', now: () => 2000000,
    readFile: async filename => { path = filename; return JSON.stringify({ claudeAiOauth: {
      accessToken: 'file-test-token', expiresAt: 3000000,
    } }); },
  }, { run: async () => ({ stdout: JSON.stringify({ claudeAiOauth: {
    accessToken: 'expired-test-token', expiresAt: 1000000,
  } }), stderr: '', exitCode: 0 }) });
  assert.equal(await auth(), 'file-test-token');
  assert.equal(path, '/fake/home/.claude/.credentials.json');
});

test('missing custom Keychain falls back only to that custom storage profile', async () => {
  let path: string | undefined;
  const auth = claudeAuthorization({ platform: 'darwin', home: '/fake/home',
    configDir: '/fake/config', secureStorageConfigDir: '/fake/storage', now: () => 2000000,
    readFile: async filename => { path = filename; return JSON.stringify({ claudeAiOauth: {
      accessToken: 'file-test-token', expiresAt: 3000000,
    } }); },
  }, { run: async () => ({ stdout: '', stderr: 'private detail', exitCode: 44 }) });
  assert.equal(await auth(), 'file-test-token');
  assert.equal(path, '/fake/storage/.credentials.json');
});
