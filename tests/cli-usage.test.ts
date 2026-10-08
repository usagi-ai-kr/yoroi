import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAgyUsage, parseClaudeUsage } from '../src/infra/cli-usage-parser.js';

const now = '2026-10-07T00:00:00Z';

test('cli-usage-parser strips ANSI sequences from AGY and Claude output', () => {
  const agyAnsi = '\x1b[32mGemini Models\x1b[0m\t\x1b[1mWeekly Limit Remaining\x1b[0m\t85%\t2026-10-14T00:00:00Z\n';
  const agySnap = parseAgyUsage(agyAnsi, now);
  assert.equal(agySnap.windows.length, 1);
  assert.equal(agySnap.windows[0]?.percent, 15);
  assert.equal(agySnap.windows[0]?.remaining, 85);

  const claudeAnsi = '\x1b[34mCurrent session:\x1b[0m \x1b[1m30%\x1b[0m used\n' +
    '\x1b[34mCurrent week (all models):\x1b[0m \x1b[1m50%\x1b[0m used\n';
  const claudeSnap = parseClaudeUsage(claudeAnsi, now);
  assert.equal(claudeSnap.windows.length, 2);
  assert.equal(claudeSnap.windows[0]?.percent, 30);
  assert.equal(claudeSnap.windows[1]?.percent, 50);
});

test('cli-usage-parser rejects invalid formats and missing windows', () => {
  assert.throws(() => parseAgyUsage('', now), { code: 'parse' });
  assert.throws(() => parseAgyUsage('just some random words', now), { code: 'parse' });
  assert.throws(() => parseClaudeUsage('', now), { code: 'parse' });
  assert.throws(() => parseClaudeUsage('no metrics here', now), { code: 'parse' });
});
