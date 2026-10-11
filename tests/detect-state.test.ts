import assert from 'node:assert/strict';
import test from 'node:test';
import { detectEventSource, safeModelId, type DetectEvent } from '../src/app/detect-events.js';
import { MemoryDetectStateStore } from '../src/app/detect-state-memory.js';
import { detectKeys, leaseTtlMs, MAX_STATE_VALUE_CHARS, readState, writeState } from '../src/app/detect-state-port.js';
import type { UsageDetectState } from '../src/app/detect-usage.js';
import { INITIAL_PROBE_STATE, type ProbeBudgetState } from '../src/app/probe-budget.js';

const T = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000, TTL = leaseTtlMs(5 * MIN);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

test('every event kind maps to one source and usage events from DT3 are reused as-is', () => {
  const at = '2026-10-11T00:00:00.000Z';
  const events: DetectEvent[] = [
    { kind: 'exceeded', eventId: 7, observedAt: at, model: 'free', retryAt: at }, { kind: 'cleared', eventId: 8, observedAt: at },
    { kind: 'retry-passed', observedAt: at, retryAt: at }, { kind: 'plugin-stale', observedAt: at, processStartedAt: at },
    { kind: 'exhausted', provider: 'claude', windowId: '5h', unit: 'percent', observedAt: at },
    { kind: 'stale', provider: 'codex', windowId: 'w', unit: 'u', observedAt: at, ageMs: 1 },
    { kind: 'detector-gap', observedAt: at, gapMs: 600_000 }];
  assert.deepEqual(events.map(detectEventSource), ['zen', 'zen', 'zen', 'zen', 'usage', 'usage', 'detector']);
});
test('model ids are limited to a safe identifier shape; free text, escapes and overlong values are dropped', () => {
  for (const ok of ['free', 'space-bunny-free', 'opencode/model:1.5+x']) assert.equal(safeModelId(ok), ok);
  for (const bad of ['', ' lead', 'a b', 'x\n', 'x\u001b[31m', 'a'.repeat(65), '-bad', null, undefined]) assert.equal(safeModelId(bad), undefined);
});
test('KV validates keys and value size, deletes, and builds encoded keys that stay valid', () => {
  const store = new MemoryDetectStateStore();
  const key = detectKeys.usage('claude', '5h/week x', 'percent %');
  assert.match(key, /^usage:claude:5h%2Fweek%20x:percent%20%25$/);
  store.set(key, '{"a":1}'); assert.equal(store.get(key), '{"a":1}');
  store.delete(key); assert.equal(store.get(key), undefined);
  for (const bad of ['', 'has space', 'x'.repeat(201), 'line\nbreak']) assert.throws(() => store.set(bad, 'v'), RangeError);
  assert.throws(() => store.set('k', 'x'.repeat(MAX_STATE_VALUE_CHARS + 1)), RangeError);
  store.set('k', 'x'.repeat(MAX_STATE_VALUE_CHARS));
});
test('JSON state round-trips DT3 and DT4 state; corrupt or mismatched values read as no state', () => {
  const store = new MemoryDetectStateStore();
  const usage: UsageDetectState = { provider: 'claude', windowId: '5h', unit: 'percent', exhausted: true, stale: false, exhaustedResetAt: '2026-10-11T01:00:00Z' };
  const usageKey = detectKeys.usage('claude', '5h', 'percent'); writeState(store, usageKey, usage);
  assert.deepEqual(readState(store, usageKey, (v): v is UsageDetectState => isObject(v) && v.provider === 'claude'), usage);
  const probe: ProbeBudgetState = { ...INITIAL_PROBE_STATE, lastAttemptAtMs: T, cooldownUntilMs: T + 15 * MIN, consecutiveFailures: 1 };
  const probeKey = detectKeys.probe('claude', 'scope-1'); writeState(store, probeKey, probe);
  assert.deepEqual(readState(store, probeKey, (v): v is ProbeBudgetState => isObject(v) && typeof v.consecutiveFailures === 'number'), probe);
  writeState(store, detectKeys.zen('cursor'), { id: 41 });
  assert.deepEqual(readState(store, detectKeys.zen('cursor'), (v): v is { id: number } => isObject(v) && typeof v.id === 'number'), { id: 41 });
  store.set(detectKeys.zen('retry-passed'), '{not json');
  assert.equal(readState(store, detectKeys.zen('retry-passed'), (v): v is object => isObject(v)), undefined);
  assert.equal(readState(store, usageKey, (v): v is { id: number } => isObject(v) && typeof v.id === 'number'), undefined);
  assert.equal(readState(store, 'missing', (v): v is object => isObject(v)), undefined);
});
test('lease: one live holder, heartbeat renew, expiry takeover with previous holder, fenced old owner', () => {
  const store = new MemoryDetectStateStore();
  assert.equal(TTL, 10 * MIN);
  const a = store.acquireLease('detector-a', T, TTL);
  assert.ok(a.acquired && a.takeover === undefined && a.lease.expiresAtMs === T + TTL);
  const denied = store.acquireLease('detector-b', T + 5 * MIN, TTL);
  assert.ok(!denied.acquired && denied.heldBy.owner === 'detector-a');
  assert.equal(store.renewLease('detector-a', T + 5 * MIN, TTL), true);
  assert.equal(store.getLease()?.expiresAtMs, T + 15 * MIN);
  assert.ok(!store.acquireLease('detector-b', T + 15 * MIN - 1, TTL).acquired);
  const took = store.acquireLease('detector-b', T + 15 * MIN, TTL);
  assert.ok(took.acquired && took.takeover?.owner === 'detector-a' && took.takeover.renewedAtMs === T + 5 * MIN);
  assert.equal(store.renewLease('detector-a', T + 16 * MIN, TTL), false);
  store.releaseLease('detector-a'); assert.equal(store.getLease()?.owner, 'detector-b');
});
test('lease: same owner re-acquire keeps its start, release frees it, and arguments are validated', () => {
  const store = new MemoryDetectStateStore();
  store.acquireLease('detector-a', T, TTL);
  const again = store.acquireLease('detector-a', T + MIN, TTL);
  assert.ok(again.acquired && again.takeover === undefined && again.lease.acquiredAtMs === T && again.lease.renewedAtMs === T + MIN);
  (store.getLease() as { owner: string }).owner = 'tampered'; assert.equal(store.getLease()?.owner, 'detector-a');
  store.releaseLease('detector-a'); assert.equal(store.getLease(), undefined);
  assert.equal(store.renewLease('detector-a', T, TTL), false);
  assert.ok(store.acquireLease('detector-b', T, TTL).acquired);
  for (const [owner, now, ttl] of [['', T, TTL], ['bad owner', T, TTL], ['a', -1, TTL], ['a', T, 0], ['a', Number.NaN, TTL]] as [string, number, number][])
    assert.throws(() => store.acquireLease(owner, now, ttl), RangeError);
});
