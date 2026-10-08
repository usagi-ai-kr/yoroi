import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ClaudeSource } from '../src/infra/claude-source.js';
import type { ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';

const observedAt = '2026-10-07T00:00:00Z';
const fixture = await readFile(new URL('./fixtures/claude-usage.txt', import.meta.url), 'utf8');

function runner(stdout: string, exitCode = 0, stderr = ''): ProcessRunner {
  return { run: async (_request: ProcessRequest) => ({ stdout, stderr, exitCode }) };
}

test('Claude source runs claude -p /usage and maps session/weekly windows', async () => {
  const fake: ProcessRunner = { run: async request => {
    assert.equal(request.executable, 'claude');
    assert.deepEqual(request.args, ['-p', '/usage']);
    return { stdout: fixture, stderr: '', exitCode: 0 };
  } };
  const snapshot = await new ClaudeSource(fake, 'claude', 5000, () => observedAt).read();
  assert.equal(snapshot.provider, 'claude');
  assert.equal(snapshot.windows.length, 2);
  assert.equal(snapshot.windows[0]?.id, 'session:5h');
  assert.equal(snapshot.windows[0]?.percent, 25);
  assert.equal(snapshot.windows[1]?.id, 'weekly:7d');
  assert.equal(snapshot.windows[1]?.percent, 60);
});

test('Claude source normalizes exit code and authentication errors', async () => {
  await assert.rejects(new ClaudeSource(runner('', 1)).read(), { code: 'exit' });
  await assert.rejects(new ClaudeSource(runner('Please run /login to authenticate')).read(), {
    code: 'authentication',
  });
  await assert.rejects(new ClaudeSource(runner('', 1, 'Error: unauthorized /login required')).read(), {
    code: 'authentication',
  });
  await assert.rejects(new ClaudeSource(runner('Unexpected plain text without usage')).read(), {
    code: 'parse',
  });
});
