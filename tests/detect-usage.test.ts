import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateUsage, type UsageDetectState, type UsageSample } from '../src/app/detect-usage.js';
import type { UsageWindow } from '../src/domain/usage.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000;
const thresholds = { surgePercentPoints: 20, staleAfterMs: 45 * MIN };
const at = (minutes: number) => new Date(T0 + minutes * MIN).toISOString();
const sample = (minutes: number, w: Partial<UsageWindow> = {}, provider: 'claude' | 'codex' = 'claude'): UsageSample =>
  ({ provider, observedAt: at(minutes), window: { id: '5h', unit: 'percent', ...w } });
/** Runs one cycle at `now = observedAt` unless given, threading state like the detector will. */
function cycle(state: UsageDetectState | undefined, latest: UsageSample, extra: { previous?: UsageSample; now?: number } = {}) {
  return evaluateUsage({ latest, ...(state && { state }), now: extra.now ?? Date.parse(latest.observedAt), thresholds,
    ...(extra.previous && { previous: extra.previous }) });
}

test('exhaustion by remaining 0 or percent >= 100 alerts once, stays silent, then releases on a value drop', () => {
  for (const w of [{ remaining: 0 }, { percent: 100 }]) {
    const a = cycle(undefined, sample(0, w)); assert.deepEqual(a.events.map(e => e.kind), ['exhausted']);
    const b = cycle(a.state, sample(5, w)); assert.deepEqual(b.events, []);
    const c = cycle(b.state, sample(10, { percent: 60, remaining: 40 }));
    assert.deepEqual(c.events.map(e => [e.kind, e.reason]), [['recovered', 'value-dropped']]);
    assert.deepEqual(cycle(c.state, sample(15, { percent: 61 })).events, []);
  }
  assert.deepEqual(cycle(undefined, sample(0, { percent: 99.9, remaining: 1 })).events, []);
});
test('release by a moved reset boundary names the reset; normal → alert → release repeats for the next period', () => {
  const a = cycle(undefined, sample(0, { percent: 100, resetAt: at(60) }));
  const b = cycle(a.state, sample(65, { percent: 3, resetAt: at(360) }));
  assert.deepEqual(b.events.map(e => [e.kind, e.reason]), [['recovered', 'reset-advanced']]);
  const c = cycle(b.state, sample(300, { percent: 100, resetAt: at(360) }));
  assert.deepEqual(c.events.map(e => e.kind), ['exhausted']);
});
test('a drifting resetAt or a new period that is still exhausted never floods alerts', () => {
  const a = cycle(undefined, sample(0, { percent: 100, resetAt: at(60) }));
  const drift = cycle(a.state, sample(5, { percent: 100, resetAt: new Date(T0 + 60 * MIN + 30_000).toISOString() }));
  assert.deepEqual(drift.events, []); assert.equal(drift.state.exhaustedResetAt, at(60));
  const next = cycle(drift.state, sample(65, { percent: 100, resetAt: at(360) }));
  assert.deepEqual(next.events, []); assert.equal(next.state.exhaustedResetAt, at(360));
});
test('surge needs a real percent-point rise over the threshold and fires once per sample', () => {
  const previous = sample(0, { percent: 10 }), latest = sample(30, { percent: 35 });
  const a = cycle(undefined, latest, { previous });
  assert.deepEqual(a.events.map(e => [e.kind, e.deltaPercent, e.elapsedMs]), [['surge', 25, 30 * MIN]]);
  assert.deepEqual(cycle(a.state, latest, { previous }).events, []);
  assert.equal(cycle(a.state, sample(60, { percent: 60 }), { previous: latest }).events[0]?.kind, 'surge');
  assert.deepEqual(cycle(undefined, sample(30, { percent: 29 }), { previous }).events, []);
  assert.deepEqual(cycle(undefined, sample(30, { percent: 5 }), { previous }).events, []);
});
test('window, unit, provider mismatches and reset boundaries are never compared as a surge', () => {
  const latest = sample(30, { percent: 90 });
  for (const previous of [sample(0, { id: '7d', percent: 1 }), sample(0, { unit: 'tokens', percent: 1 }), sample(0, { percent: 1 }, 'codex')]) {
    assert.deepEqual(cycle(undefined, latest, { previous }).events.map(e => e.kind), []);
  }
  const moved = cycle(undefined, sample(30, { percent: 90, resetAt: at(300) }), { previous: sample(0, { percent: 1, resetAt: at(20) }) });
  assert.deepEqual(moved.events, []);
  assert.deepEqual(cycle(undefined, sample(30, { used: 9 }), { previous: sample(0, { used: 1 }) }).events, []);
});
test('stale fires once when the sample is older than the threshold and resumes on a fresh sample', () => {
  const old = sample(0, { percent: 10 });
  assert.deepEqual(cycle(undefined, old, { now: T0 + 45 * MIN }).events, []);
  const a = cycle(undefined, old, { now: T0 + 46 * MIN });
  assert.deepEqual(a.events.map(e => [e.kind, e.ageMs]), [['stale', 46 * MIN]]);
  assert.deepEqual(cycle(a.state, old, { now: T0 + 90 * MIN }).events, []);
  assert.deepEqual(cycle(a.state, sample(100, { percent: 10 }), { now: T0 + 101 * MIN }).events.map(e => e.kind), ['resumed']);
});
test('a changed window or unit starts a fresh series with no cross-comparison', () => {
  const a = cycle(undefined, sample(0, { percent: 100 }));
  const other = cycle(a.state, sample(5, { id: '7d', percent: 10 }));
  assert.deepEqual(other.events, []); assert.equal(other.state.windowId, '7d'); assert.equal(other.state.exhausted, false);
  assert.deepEqual(cycle(a.state, sample(5, { unit: 'usd', remaining: 0 })).events.map(e => e.kind), ['exhausted']);
});
test('events carry only ids, numbers and times: window extras and secret-like fields never leak', () => {
  const secret = 'synthetic-secret-token';
  const latest = { ...sample(30, { percent: 100, remaining: 0, resetAt: at(60) }), token: secret, headers: { authorization: secret } };
  latest.window = { ...latest.window, apiKey: secret } as UsageWindow;
  const result = cycle(undefined, latest as UsageSample, { previous: sample(0, { percent: 10, resetAt: at(60) }), now: T0 + 200 * MIN });
  assert.deepEqual(result.events.map(e => e.kind), ['exhausted', 'surge', 'stale']);
  const allowed = new Set(['kind', 'provider', 'windowId', 'unit', 'observedAt', 'percent', 'remaining', 'resetAt', 'reason', 'deltaPercent', 'elapsedMs', 'ageMs']);
  for (const event of result.events) for (const key of Object.keys(event)) assert.ok(allowed.has(key), key);
  assert.ok(!JSON.stringify(result).includes(secret));
});
test('invalid thresholds throw and an unparsable sample time yields no events', () => {
  for (const bad of [{ surgePercentPoints: 0, staleAfterMs: 1 }, { surgePercentPoints: 1, staleAfterMs: Number.NaN }])
    assert.throws(() => evaluateUsage({ latest: sample(0), now: T0, thresholds: bad }), RangeError);
  const broken = { ...sample(0, { percent: 100 }), observedAt: 'not-a-date' };
  assert.deepEqual(evaluateUsage({ latest: broken, now: T0, thresholds }).events, []);
});
