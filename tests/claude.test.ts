import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { ClaudeSource } from '../src/infra/claude-source.js';
import { parseClaudeUsage } from '../src/infra/cli-usage-parser.js';
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

test('Claude parses the current layout with reset suffixes and extra sections', () => {
  const layout = ['You are currently using your subscription to power your Claude Code usage', '',
    'Current session: 12.5% used · resets Oct 7 at 9:50pm (Asia/Seoul)',
    'Current week (all models): 34% used · resets Oct 10 at 9:00am (Asia/Seoul)', '',
    "What's contributing to your limits usage?",
    'Approximate, based on local sessions on this machine — does not include other devices.', '',
    'Last 24h · 8 requests · 1 session',
    '  50% of your usage was at >200k context',
    '  Top skills: /issue-writing 25%'].join('\n');
  const snapshot = parseClaudeUsage(layout, observedAt);

  assert.deepEqual(snapshot.windows.map(window => [window.id, window.percent]),
    [['session:5h', 12.5], ['weekly:7d', 34]]);
  assert.ok(snapshot.windows.every(window => window.resetAt === undefined));
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
