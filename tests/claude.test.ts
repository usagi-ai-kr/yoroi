import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseClaudeUsage } from '../src/infra/cli-usage-parser.js';

const observedAt = '2026-10-07T00:00:00Z';
const fixture = await readFile(new URL('./fixtures/claude-usage.txt', import.meta.url), 'utf8');

test('historical human CLI output maps session/weekly windows without executing Claude', () => {
  const snapshot = parseClaudeUsage(fixture, observedAt);
  assert.equal(snapshot.provider, 'claude');
  assert.equal(snapshot.windows.length, 2);
  assert.equal(snapshot.windows[0]?.id, 'session:5h');
  assert.equal(snapshot.windows[0]?.percent, 25);
  assert.equal(snapshot.windows[1]?.id, 'weekly:7d');
  assert.equal(snapshot.windows[1]?.percent, 60);
  assert.equal(snapshot.windows[1]?.resetAt, '2026-10-10T00:00:00.000Z');
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
  assert.deepEqual(snapshot.windows.map(window => window.resetAt),
    ['2026-10-07T12:50:00.000Z', '2026-10-10T00:00:00.000Z']);
});

test('Claude maps Sonnet resets and keeps percent when a reset is missing or invalid', () => {
  const snapshot = parseClaudeUsage([
    'Current session: 0% used',
    'Current week (all models): 100% used · resets Feb 30 at 9:00am (Asia/Seoul)',
    'Current week (Sonnet only): 15% used · resets Oct 11 at 12:00pm (Asia/Seoul)',
  ].join('\n'), observedAt);
  assert.deepEqual(snapshot.windows.map(window => [window.id, window.percent, window.resetAt]), [
    ['session:5h', 0, undefined], ['weekly:7d', 100, undefined],
    ['weekly:sonnet:7d', 15, '2026-10-11T03:00:00.000Z'],
  ]);
});

test('human CLI parser normalizes authentication and unsupported output', () => {
  assert.throws(() => parseClaudeUsage('Please run /login to authenticate', observedAt), {
    code: 'authentication',
  });
  assert.throws(() => parseClaudeUsage('Error: unauthorized /login required', observedAt), {
    code: 'authentication',
  });
  assert.throws(() => parseClaudeUsage('Unexpected plain text without usage', observedAt), {
    code: 'parse',
  });
});
