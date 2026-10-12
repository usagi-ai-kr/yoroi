import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInsights } from '../src/ui/cli/insights-args.js';

test('insights once accepts pretty, refresh, full, and markdown in any order without duplicates', () => {
  assert.deepEqual(parseInsights(['once']), { kind: 'insights', operation: 'once' });
  assert.deepEqual(parseInsights(['once', '--pretty']), { kind: 'insights', operation: 'once', pretty: true });
  assert.deepEqual(parseInsights(['once', '--full']), { kind: 'insights', operation: 'once', full: true });
  assert.deepEqual(parseInsights(['once', '--markdown']), { kind: 'insights', operation: 'once', markdown: true });
  assert.deepEqual(parseInsights(['once', '--refresh', '--pretty', '--markdown']),
    { kind: 'insights', operation: 'once', pretty: true, refresh: true, markdown: true });
});

test('insights once rejects combining --markdown with --full', () => {
  assert.deepEqual(parseInsights(['once', '--markdown', '--full']),
    { kind: 'error', message: 'cannot combine --markdown with --full' });
  assert.deepEqual(parseInsights(['once', '--full', '--markdown']),
    { kind: 'error', message: 'cannot combine --markdown with --full' });
});

test('insights help wins over any other argument', () => {
  for (const argv of [['--help'], ['-h'], ['once', '--help'], ['once', '--pretty', '-h']]) {
    assert.deepEqual(parseInsights(argv), { kind: 'help', subcommand: 'insights' });
  }
});

test('argument errors carry the exact offending token', () => {
  assert.deepEqual(parseInsights([]), { kind: 'error', message: 'missing insights operation' });
  assert.deepEqual(parseInsights(['report']), { kind: 'error', message: 'unexpected argument: report' });
  assert.deepEqual(parseInsights(['once', '--json']), { kind: 'error', message: 'unexpected argument: --json' });
  assert.deepEqual(parseInsights(['once', '--pretty', '--pretty']),
    { kind: 'error', message: 'unexpected argument: --pretty' });
});
