import assert from 'node:assert/strict';
import test from 'node:test';
import { createSnapshot } from '../src/domain/usage.js';
import { SourceError } from '../src/app/usage-source.js';

const at = '2026-10-07T00:00:00.000Z';
test('domain preserves optional metrics and multiple windows without inventing values', () => {
  const snapshot = createSnapshot('codex', at, [
    { id: '5h', unit: 'percent', percent: 25 },
    { id: 'weekly', unit: 'token', remaining: 0, limit: 100, resetAt: at },
  ]);
  assert.equal(snapshot.windows[0]?.used, undefined);
  assert.equal(snapshot.windows[1]?.remaining, 0);
  assert.equal(snapshot.windows.length, 2);
  assert.ok(Object.isFrozen(snapshot.windows[0]));
  assert.ok(Object.isFrozen(snapshot.windows));
});
test('domain rejects invalid providers, dates, numbers, units and duplicate windows', () => {
  const invalid = [
    { id: '5h', unit: 'percent', percent: 101 },
    { id: '5h', unit: 'token', remaining: -1 },
    { id: '5h', unit: 'token', used: NaN },
    { id: '5h', unit: '', used: 1 },
    { id: '5h', unit: 'token', resetAt: 'tomorrow', used: 1 },
  ];
  for (const window of invalid) assert.throws(() => createSnapshot('codex', at, [window]));
  assert.throws(() => createSnapshot('unknown' as 'codex', at, []));
  assert.throws(() => createSnapshot('codex', 'invalid', []));
  const window = { id: '5h', unit: 'percent', percent: 0 };
  assert.throws(() => createSnapshot('codex', at, [window, window]));
});
test('source errors expose normalized messages only', () => {
  for (const code of ['authentication', 'not-installed', 'parse', 'timeout', 'network',
    'unavailable', 'cancelled'] as const) {
    const error = new SourceError(code);
    assert.equal(error.code, code);
    assert.ok(error.message.length > 0);
  }
});
