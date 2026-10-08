import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { claudeAuthorization } from '../src/infra/claude-credentials.js';
import { SourceError } from '../src/app/usage-source.js';
import type { ProcessRunner, ProcessRequest } from '../src/infra/process-port.js';

const now = () => 1700000000000;
const validJson = (exp = 1700003600000) => JSON.stringify({
  claudeAiOauth: { accessToken: 'token-abc', expiresAt: exp },
});

test('explicit oauthToken takes precedence and rejects blank without fallback', async () => {
  const runner: ProcessRunner = { run: async () => assert.fail('should not be called') };
  const auth = claudeAuthorization({ oauthToken: '  sk-oauth-123  ' }, runner);
  assert.equal(await auth(), 'sk-oauth-123');

  const blank = claudeAuthorization({ oauthToken: '   ', home: '/home/user' }, runner);
  await assert.rejects(async () => blank(), new SourceError('authentication'));
});

test('darwin uses default service when configDir unset and hash suffix when set', async () => {
  let executed: ProcessRequest | undefined;
  const runner: ProcessRunner = {
    run: async (req) => { executed = req; return { stdout: validJson(), stderr: '', exitCode: 0 }; },
  };
  const defaultAuth = claudeAuthorization({ platform: 'darwin', account: 'fake-user', now }, runner);
  assert.equal(await defaultAuth(), 'token-abc');
  assert.deepEqual(executed?.args, ['find-generic-password', '-a', 'fake-user', '-s', 'Claude Code-credentials', '-w']);

  const customDir = '/custom/claude/dir';
  const expectedHash = createHash('sha256').update(customDir).digest('hex').slice(0, 8);
  const customAuth = claudeAuthorization({ platform: 'darwin', account: 'fake-user', configDir: customDir, now }, runner);
  assert.equal(await customAuth(), 'token-abc');
  assert.deepEqual(executed?.args, [
    'find-generic-password', '-a', 'fake-user', '-s', `Claude Code-credentials-${expectedHash}`, '-w',
  ]);
});

test('validates strict number epoch ms contract and rejects string/past/malformed', async () => {
  const runner = (json: string): ProcessRunner => ({
    run: async () => ({ stdout: json, stderr: '', exitCode: 0 }),
  });
  for (const exp of ['2026-10-08T00:00:00Z', 1699990000000, -1, 1.5, null, undefined]) {
    const raw = JSON.stringify({ claudeAiOauth: { accessToken: 't', expiresAt: exp } });
    await assert.rejects(
      async () => claudeAuthorization({ platform: 'darwin', now }, runner(raw))(),
      new SourceError('authentication'),
    );
  }
});

test('cancellation preserves SourceError cancelled without rewriting to auth', async () => {
  const controller = new AbortController();
  controller.abort();
  const runner: ProcessRunner = { run: async () => assert.fail('should not run') };
  const auth = claudeAuthorization({ oauthToken: 'valid-token' }, runner);
  await assert.rejects(async () => auth(controller.signal), new SourceError('cancelled'));

  const darwinRunner: ProcessRunner = {
    run: async (_, signal) => {
      if (signal?.aborted) throw new SourceError('cancelled');
      return { stdout: validJson(), stderr: '', exitCode: 0 };
    },
  };
  const darwinAuth = claudeAuthorization({ platform: 'darwin', now }, darwinRunner);
  await assert.rejects(async () => darwinAuth(controller.signal), new SourceError('cancelled'));
});

test('non-darwin resolves configDir or home/.claude, rejecting when neither present', async () => {
  const runner: ProcessRunner = { run: async () => assert.fail('should not be called') };
  let readPath = '';
  const fakeRead = async (p: string) => { readPath = p; return validJson(); };

  const homeAuth = claudeAuthorization(
    { platform: 'linux', home: '/home/alice', readFile: fakeRead, now }, runner,
  );
  assert.equal(await homeAuth(), 'token-abc');
  assert.equal(readPath, '/home/alice/.claude/.credentials.json');

  const noDirOrHome = claudeAuthorization({ platform: 'linux' }, runner);
  await assert.rejects(async () => noDirOrHome(), new SourceError('authentication'));
});
