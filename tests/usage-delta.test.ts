import assert from 'node:assert/strict';
import test from 'node:test';
import { computeUsageDelta } from '../src/domain/usage-delta.js';
import type { UsageDeltaObservation, UsageDeltaPair } from '../src/domain/usage-delta.js';
import type { UsageWindow } from '../src/domain/usage.js';

function obs(observedAt: string, window: Partial<UsageWindow> & Pick<UsageWindow, 'id' | 'unit'>,
  overrides: Partial<Omit<UsageDeltaObservation, 'observedAt' | 'window'>> = {}): UsageDeltaObservation {
  return {
    provider: 'claude', scope: 'profile-a', contractVersion: 'claude@1',
    observedAt, window: { ...window }, ...overrides,
  };
}
const t = (hour: number) => `2026-10-10T0${hour}:00:00.000Z`;
const pair = (latest: UsageDeltaObservation, previous: UsageDeltaObservation): UsageDeltaPair =>
  [latest, previous];

test('delta: latest minus previous, signed, %p; partial metric omitted', () => {
  const previous = obs(t(1), { id: '5h', unit: 'percent', percent: 20, used: 200, remaining: 800, limit: 1000 });
  const latest = obs(t(2), { id: '5h', unit: 'percent', percent: 24, used: 260, remaining: 740, limit: 1000 });
  assert.deepEqual(computeUsageDelta(pair(latest, previous)), {
    status: 'delta', observedAt: t(2), previousObservedAt: t(1),
    elapsedMs: 3_600_000, values: { used: 60, remaining: -60, limit: 0, percent: 4 },
  });
  const sparse = computeUsageDelta(pair(obs(t(2), { id: '5h', unit: 'percent', percent: 24, used: 260 }),
    obs(t(1), { id: '5h', unit: 'percent', percent: 20 })));
  assert.deepEqual(sparse.status === 'delta' ? sparse.values : {}, { percent: 4 });
});

test('no-previous: empty and single observation', () => {
  assert.deepEqual(computeUsageDelta([]), { status: 'n/a', reason: 'no-previous' });
  assert.deepEqual(computeUsageDelta([obs(t(1), { id: '5h', unit: 'percent', percent: 20 })]),
    { status: 'n/a', reason: 'no-previous' });
});

test('identity-mismatch: provider/scope/contract/window/unit differ', () => {
  const previous = obs(t(1), { id: '5h', unit: 'percent', percent: 20 });
  const cases = [
    obs(t(2), { id: '5h', unit: 'percent', percent: 30 }, { provider: 'codex' }),
    obs(t(2), { id: '5h', unit: 'percent', percent: 30 }, { scope: 'profile-b' }),
    obs(t(2), { id: '5h', unit: 'percent', percent: 30 }, { contractVersion: 'claude@2' }),
    obs(t(2), { id: 'w', unit: 'percent', percent: 30 }),
    obs(t(2), { id: '5h', unit: 'tokens', percent: 30 }),
  ];
  for (const latest of cases) {
    assert.deepEqual(computeUsageDelta(pair(latest, previous)), { status: 'n/a', reason: 'identity-mismatch' });
  }
});

test('invalid-time: bad or non-increasing observedAt', () => {
  const at = (o: string) => obs(o, { id: '5h', unit: 'percent', percent: 20 });
  assert.deepEqual(computeUsageDelta(pair(obs(t(2), { id: '5h', unit: 'percent', percent: 30 }), at('not-a-date'))),
    { status: 'n/a', reason: 'invalid-time' });
  assert.deepEqual(computeUsageDelta(pair(at(t(1)), at(t(2)))), { status: 'n/a', reason: 'invalid-time' });
  assert.deepEqual(computeUsageDelta(pair(at(t(2)), at(t(2)))), { status: 'n/a', reason: 'invalid-time' });
});

test('reset: boundary advanced forward', () => {
  const resetPrev = obs(t(1), { id: '5h', unit: 'percent', percent: 20, resetAt: '2026-10-10T05:00:00.000Z' });
  const resetNext = obs(t(2), { id: '5h', unit: 'percent', percent: 5, resetAt: '2026-10-10T10:00:00.000Z' });
  assert.deepEqual(computeUsageDelta(pair(resetNext, resetPrev)), { status: 'reset', reason: 'reset-at-advanced' });
  const startPrev = obs(t(1), { id: '5h', unit: 'percent', percent: 20, periodStart: '2026-10-10T00:00:00.000Z' });
  const startNext = obs(t(2), { id: '5h', unit: 'percent', percent: 5, periodStart: '2026-10-10T05:00:00.000Z' });
  assert.deepEqual(computeUsageDelta(pair(startNext, startPrev)), { status: 'reset', reason: 'period-start-advanced' });
});

test('reset-anomaly: backward, vanished, or conflicting boundaries', () => {
  const base = obs(t(1), { id: '5h', unit: 'percent', percent: 20, periodStart: '2026-10-10T00:00:00.000Z', resetAt: '2026-10-10T05:00:00.000Z' });
  const backward = obs(t(2), { id: '5h', unit: 'percent', percent: 30, resetAt: '2026-10-10T04:00:00.000Z' });
  const vanished = obs(t(2), { id: '5h', unit: 'percent', percent: 30, periodStart: '2026-10-10T01:00:00.000Z' });
  const conflicting = obs(t(2), { id: '5h', unit: 'percent', percent: 5, periodStart: '2026-10-10T01:00:00.000Z', resetAt: '2026-10-10T04:00:00.000Z' });
  for (const latest of [backward, vanished, conflicting]) {
    assert.deepEqual(computeUsageDelta(pair(latest, base)), { status: 'n/a', reason: 'reset-anomaly' });
  }
});

test('period-mismatch: one side lacks the field', () => {
  const previous = obs(t(1), { id: '5h', unit: 'percent', percent: 20 });
  const latest = obs(t(2), { id: '5h', unit: 'percent', percent: 30, resetAt: '2026-10-10T05:00:00.000Z' });
  assert.deepEqual(computeUsageDelta(pair(latest, previous)), { status: 'n/a', reason: 'period-mismatch' });
});

test('missing-metric: no comparable metrics', () => {
  assert.deepEqual(computeUsageDelta(pair(obs(t(2), { id: '5h', unit: 'percent' }), obs(t(1), { id: '5h', unit: 'percent' }))),
    { status: 'n/a', reason: 'missing-metric' });
});
