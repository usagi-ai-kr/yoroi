import assert from 'node:assert/strict';
import test from 'node:test';
import { parseClaudeApiUsage } from '../src/infra/claude-api-parser.js';

test('API resets reject impossible offset hours/minutes rather than shifting the reset date', () => {
  for (const offset of ['+24:00', '-99:00', '+01:60', '-00:99']) {
    const body = JSON.stringify({ five_hour: { utilization: 25,
      resets_at: `2026-10-08T09:00:00${offset}` } });
    assert.throws(() => parseClaudeApiUsage(body, '2026-10-08T00:00:00Z'), { code: 'parse' });
  }
});

test('API reset fractions normalize to milliseconds with zero padding', () => {
  const body = JSON.stringify({ five_hour: { utilization: 1,
    resets_at: '2026-10-08T00:00:00.5Z' } });
  const snapshot = parseClaudeApiUsage(body, '2026-10-08T00:00:00Z');
  assert.equal(snapshot.windows[0]?.resetAt, '2026-10-08T00:00:00.500Z');
});

test('API seven_day_sonnet maps to its own reset window without cost inference', () => {
  const snapshot = parseClaudeApiUsage(JSON.stringify({ five_hour: null,
    seven_day_sonnet: { utilization: 10, resets_at: '2026-10-10T10:30:00-03:30' },
    extra_usage: { utilization: 99, used_credits: 999 },
  }), '2026-10-08T00:00:00Z');
  assert.deepEqual(snapshot.windows, [{ id: 'weekly:sonnet:7d', unit: 'percent', percent: 10,
    resetAt: '2026-10-10T14:00:00.000Z' }]);
});
