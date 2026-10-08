import assert from 'node:assert/strict';
import test from 'node:test';
import { claudeAuthorization } from '../src/infra/claude-credentials.js';

test('empty custom config directory cannot fall back to another credential store', async () => {
  for (const platform of ['darwin', 'linux']) {
    const auth = claudeAuthorization({ platform, home: '/fake/home', configDir: ' ',
      readFile: async () => assert.fail('must not read default file') },
    { run: async () => assert.fail('must not read default keychain') });
    await assert.rejects(auth(), { code: 'authentication' });
  }
});

test('cancellation during keychain lookup is forwarded and does not turn into authentication', async () => {
  const controller = new AbortController();
  const auth = claudeAuthorization({ platform: 'darwin' }, { run: async (_request, signal) => {
    assert.equal(signal, controller.signal);
    controller.abort();
    throw new Error('private credential detail');
  } });
  await assert.rejects(auth(controller.signal), { code: 'cancelled', message: 'Usage query was cancelled' });
});

test('credential file failure is normalized without raw details', async () => {
  const auth = claudeAuthorization({ platform: 'linux', home: '/fake/home',
    readFile: async () => { throw new Error('private credential detail'); } },
  { run: async () => assert.fail('file-only store') });
  await assert.rejects(auth(), { code: 'authentication' });
});
