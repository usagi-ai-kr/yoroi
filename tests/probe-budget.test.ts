import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROBE_INTERVALS, INITIAL_PROBE_STATE, decideProbe, recordProbeAttempt,
  recordProbeResult, type ProbeBudgetState } from '../src/app/probe-budget.js';
import { providers } from '../src/domain/usage.js';

const MINUTE = 60_000;
const start = Date.parse('2026-10-11T00:00:00Z');
const restore = (state: ProbeBudgetState): ProbeBudgetState => JSON.parse(JSON.stringify(state));

test('five-minute cycles obey independent provider intervals and exact boundaries', () => {
  for (const provider of providers) {
    let now = start;
    assert.equal(decideProbe(provider, INITIAL_PROBE_STATE, now).allowed, true);
    const state = recordProbeAttempt(INITIAL_PROBE_STATE, now);
    const interval = DEFAULT_PROBE_INTERVALS[provider];
    for (now += 5 * MINUTE; now < start + interval; now += 5 * MINUTE) {
      assert.deepEqual(decideProbe(provider, state, now), {
        allowed: false, reason: 'interval', nextProbeAtMs: start + interval,
      });
    }
    assert.equal(decideProbe(provider, state, now).allowed, true);
  }
  assert.equal(DEFAULT_PROBE_INTERVALS.claude, 30 * MINUTE);
  assert.equal(DEFAULT_PROBE_INTERVALS['opencode-go'], 15 * MINUTE);
});

test('a manual once sample skips provider work; future samples do not suppress calls', () => {
  const now = start + 5 * MINUTE;
  assert.deepEqual(decideProbe('claude', INITIAL_PROBE_STATE, now, start), {
    allowed: false, reason: 'fresh-sample', nextProbeAtMs: start + 30 * MINUTE,
  });
  assert.equal(decideProbe('claude', INITIAL_PROBE_STATE, start + 30 * MINUTE, start).allowed, true);
  assert.equal(decideProbe('claude', INITIAL_PROBE_STATE, now, now + 1).allowed, true);
  assert.equal(decideProbe('claude', INITIAL_PROBE_STATE, now, start, { claude: 5 * MINUTE }).allowed, true);
});

test('unavailable and 429 share 15/30/60-minute cooldowns; JSON restart retains them', () => {
  let state = INITIAL_PROBE_STATE;
  let now = start;
  for (const minutes of [15, 30, 60, 60]) {
    state = recordProbeAttempt(restore(state), now);
    state = restore(recordProbeResult(state, minutes === 30 ? 'rate-limited' : 'unavailable', now));
    assert.equal(state.cooldownUntilMs, now + minutes * MINUTE);
    assert.equal(decideProbe('opencode-go', state, now + minutes * MINUTE - 1).allowed, false);
    now += minutes * MINUTE;
    assert.equal(decideProbe('opencode-go', state, now).allowed, true);
  }
  const before = JSON.stringify(state);
  const success = recordProbeResult(state, 'success', now);
  assert.equal(success.consecutiveFailures, 0);
  assert.equal(success.cooldownUntilMs, undefined);
  assert.equal(JSON.stringify(state), before, 'input remains immutable');
  assert.equal(recordProbeResult(success, 'unavailable', now).cooldownUntilMs, now + 15 * MINUTE);
});

test('Retry-After seconds/date take priority; invalid values fall back and huge values stay JSON-safe', () => {
  for (const header of ['7200', new Date(start + 120 * MINUTE).toUTCString()]) {
    const state = recordProbeResult(INITIAL_PROBE_STATE, 'rate-limited', start, header);
    assert.equal(restore(state).cooldownUntilMs, start + 120 * MINUTE);
    assert.equal(decideProbe('claude', state, start + 60 * MINUTE).reason, 'cooldown');
  }
  assert.equal(recordProbeResult(INITIAL_PROBE_STATE, 'unavailable', start, 'bad').cooldownUntilMs,
    start + 15 * MINUTE);
  for (const header of ['0', new Date(start - MINUTE).toUTCString()]) {
    const state = recordProbeResult(INITIAL_PROBE_STATE, 'rate-limited', start, header);
    assert.equal(state.cooldownUntilMs, start);
    assert.equal(decideProbe('claude', state, start).reason, 'interval');
  }
  const huge = restore(recordProbeResult(INITIAL_PROBE_STATE, 'rate-limited', start, '9'.repeat(400)));
  assert.equal(huge.cooldownUntilMs, Number.MAX_SAFE_INTEGER);
});

test('restart preserves in-flight budget; other failures do not create cooldown; bad input is rejected', () => {
  const attempt = restore(recordProbeAttempt(INITIAL_PROBE_STATE, start));
  assert.equal(decideProbe('codex', attempt, start + 5 * MINUTE).allowed, false);
  assert.deepEqual(recordProbeResult(attempt, 'failed', start + 1), attempt);
  assert.throws(() => decideProbe('claude', attempt, NaN), RangeError);
  assert.throws(() => decideProbe('claude', attempt, start, undefined, { claude: 0 }), RangeError);
  assert.throws(() => recordProbeResult({ consecutiveFailures: -1 }, 'success', start), RangeError);
});

test('sample, interval and cooldown gates compose without shortening one another', () => {
  const state = recordProbeResult(recordProbeAttempt(INITIAL_PROBE_STATE, start), 'unavailable', start, '3600');
  const now = start + 20 * MINUTE;
  assert.equal(decideProbe('claude', state, now, now).nextProbeAtMs, start + 60 * MINUTE);
  assert.equal(decideProbe('claude', state, now, now, { claude: 50 * MINUTE }).reason, 'fresh-sample');
  assert.equal(decideProbe('claude', state, now, now, { claude: 50 * MINUTE }).nextProbeAtMs,
    start + 70 * MINUTE);
  assert.equal(decideProbe('opencode-go', INITIAL_PROBE_STATE, now).allowed, true);
});
