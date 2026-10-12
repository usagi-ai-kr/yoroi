import assert from 'node:assert/strict';
import test from 'node:test';
import { computeTrendStats } from '../src/domain/trend-calc.js';
import type { UsageObservation } from '../src/app/usage-history-port.js';

function makeObs(observedAt: string, val: number, extra: Partial<UsageObservation['window']> = {},
  ctx: Partial<UsageObservation> = {}): UsageObservation {
  return {
    provider: 'claude', scope: 'user', contractVersion: '1', observedAt,
    window: { id: '5h', unit: 'percent', percent: val, ...extra },
    ...ctx,
  };
}

const NOW = Date.parse('2026-10-11T12:00:00Z');
const h = (offset: number) => new Date(NOW + offset * 3600 * 1000).toISOString();

test('empty samples returns empty status and null delta/rate', () => {
  const res = computeTrendStats([], '24h', NOW);
  assert.deepEqual(res, {
    period: '24h', sampleCount: 0, delta: null, ratePerHour: null, resets: 0, gaps: 0, status: 'empty',
  });
});

test('insufficient samples (< 2) returns insufficient status', () => {
  const single = [makeObs(h(-2), 20)];
  const res = computeTrendStats(single, '24h', NOW);
  assert.equal(res.status, 'insufficient');
  assert.equal(res.sampleCount, 1);
  assert.equal(res.delta, null);
  assert.equal(res.ratePerHour, null);
});

test('normal 2+ samples computes signed delta and ratePerHour', () => {
  const samples = [
    makeObs(h(-4), 10),
    makeObs(h(-2), 20),
    makeObs(h(0), 30),
  ];
  const res = computeTrendStats(samples, '24h', NOW);
  assert.equal(res.status, 'sufficient');
  assert.equal(res.sampleCount, 3);
  assert.equal(res.delta, 20);
  assert.equal(res.ratePerHour, 5); // 20 delta over 4 hours = 5 / h
  assert.equal(res.resets, 0);
  assert.equal(res.gaps, 0);
});

test('reset_at change separates segment and does not cross-calculate delta', () => {
  const samples = [
    makeObs(h(-6), 80, { resetAt: '2026-10-11T08:00:00Z' }),
    makeObs(h(-5), 90, { resetAt: '2026-10-11T08:00:00Z' }),
    makeObs(h(-2), 10, { resetAt: '2026-10-11T13:00:00Z' }),
    makeObs(h(0), 20, { resetAt: '2026-10-11T13:00:00Z' }),
  ];
  const res = computeTrendStats(samples, '24h', NOW);
  assert.equal(res.status, 'sufficient');
  assert.equal(res.sampleCount, 4);
  assert.equal(res.resets, 1);
  assert.equal(res.delta, 10); // only latest segment: 20 - 10 = 10 (not 20 - 80)
  assert.equal(res.ratePerHour, 5); // 10 / 2h
});

test('reset_at change leaving single sample makes delta insufficient', () => {
  const samples = [
    makeObs(h(-5), 80, { resetAt: '2026-10-11T08:00:00Z' }),
    makeObs(h(-4), 90, { resetAt: '2026-10-11T08:00:00Z' }),
    makeObs(h(0), 5, { resetAt: '2026-10-11T13:00:00Z' }),
  ];
  const res = computeTrendStats(samples, '24h', NOW);
  assert.equal(res.status, 'insufficient');
  assert.equal(res.sampleCount, 3);
  assert.equal(res.resets, 1);
  assert.equal(res.delta, null);
});

test('period filtering respects 24h and 7d window cutoffs and detects gaps', () => {
  const samples = [
    makeObs(h(-48), 5), // outside 24h, inside 7d
    makeObs(h(-10), 10), // inside 24h
    makeObs(h(0), 25), // inside 24h
  ];
  const res24h = computeTrendStats(samples, '24h', NOW);
  assert.equal(res24h.sampleCount, 2);
  assert.equal(res24h.delta, 15);
  assert.equal(res24h.gaps, 1); // 10h gap > 4h

  const res7d = computeTrendStats(samples, '7d', NOW);
  assert.equal(res7d.sampleCount, 3);
  assert.equal(res7d.delta, 20);
});
