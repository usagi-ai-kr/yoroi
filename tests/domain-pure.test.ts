import assert from 'node:assert/strict';
import test from 'node:test';
import { createWindowKey, freezeSnapshot, isProviderId, isUsageMetricType, isUsageSnapshot, isUsageWindow } from '../src/domain/types.js';
import { createSnapshot } from '../src/domain/usage.js';
const at = '2026-10-07T00:00:00.000Z';
test('metric guard accepts only used/remaining/limit/percent', () => {
  for (const metric of ['used', 'remaining', 'limit', 'percent']) assert.equal(isUsageMetricType(metric), true);
  for (const other of ['usd', '', 1, undefined, null, {}]) assert.equal(isUsageMetricType(other), false);
});
test('provider guard accepts only known providers', () => {
  for (const id of ['ollama-pro', 'opencode-go', 'codex', 'agy', 'claude']) assert.equal(isProviderId(id), true);
  for (const other of ['unknown', '', 1, undefined, null]) assert.equal(isProviderId(other), false);
});
test('window guard checks identity and finite non-negative metrics', () => {
  assert.equal(isUsageWindow({ id: '5h', unit: 'percent', percent: 25 }), true);
  assert.equal(isUsageWindow({ id: '', unit: 'percent' }), false);
  assert.equal(isUsageWindow({ id: '5h', unit: ' ' }), false);
  assert.equal(isUsageWindow({ id: '5h', unit: 'token', used: -1 }), false);
  assert.equal(isUsageWindow({ id: '5h', unit: 'token', used: NaN }), false);
  assert.equal(isUsageWindow({ id: '5h', unit: 'percent', percent: 101 }), false);
  assert.equal(isUsageWindow(null), false);
});
test('snapshot guard accepts createSnapshot output and rejects shapes', () => {
  const snapshot = createSnapshot('codex', at, [{ id: '5h', unit: 'percent', percent: 25 }]);
  assert.equal(isUsageSnapshot(snapshot), true);
  assert.equal(isUsageSnapshot({ provider: 'codex', observedAt: at, windows: [] }), true);
  assert.equal(isUsageSnapshot({ provider: 'unknown', observedAt: at, windows: [] }), false);
  assert.equal(isUsageSnapshot({ provider: 'codex', observedAt: at, windows: [{ id: '', unit: 'x' }] }), false);
  assert.equal(isUsageSnapshot(null), false);
});
test('window key factory builds provider-scoped keys and rejects blanks', () => {
  assert.equal(createWindowKey('codex', '5h'), 'codex:5h');
  assert.equal(createWindowKey('claude', 'weekly'), 'claude:weekly');
  assert.throws(() => createWindowKey('codex', '  '));
  assert.throws(() => createWindowKey('unknown' as 'codex', '5h'));
});
test('freeze factory returns frozen snapshot compatible with domain', () => {
  const frozen = freezeSnapshot({ provider: 'codex', observedAt: at, windows: [{ id: '5h', unit: 'percent', percent: 10 }] });
  assert.equal(frozen.provider, 'codex');
  assert.equal(frozen.windows.length, 1);
  assert.ok(Object.isFrozen(frozen));
  assert.ok(Object.isFrozen(frozen.windows));
  assert.ok(Object.isFrozen(frozen.windows[0]));
  assert.equal(isUsageSnapshot(frozen), true);
});
