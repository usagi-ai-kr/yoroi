import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { detectZen } from '../src/app/detect-zen.js';
import { MemoryDetectStateStore } from '../src/app/detect-state-memory.js';
import type { DetectStateStore } from '../src/app/detect-state-port.js';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { ZEN_FREE_SCOPE as S, type ZenLockStore } from '../src/app/zen-lock-port.js';
import { openDetectStateStore } from '../src/infra/sqlite/detect-state-store.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';
const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000, GRACE = 10 * MIN;
const at = (m: number) => new Date(T0 + m * MIN).toISOString();
const run = (lock: ZenLockStore, state: DetectStateStore, m: number, started?: number) => detectZen({ lock, state,
  nowMs: T0 + m * MIN, pluginStaleGraceMs: GRACE, ...(started !== undefined && { opencodeStartedAtMs: T0 + started * MIN }) });
const kinds = (e: readonly { kind: string }[]) => e.map(x => x.kind);

test('first run starts at the current newest event: history is never replayed, later events appear once and in order', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  lock.markExceeded({ scope: S, model: 'old-free', observedAt: at(-60) }); lock.markOk({ scope: S, observedAt: at(-50) });
  assert.deepEqual(run(lock, state, 0), []);
  lock.markExceeded({ scope: S, model: 'free', observedAt: at(1) }); lock.markExceeded({ scope: S, model: 'free', observedAt: at(2), retryAt: at(300) });
  lock.markOk({ scope: S, model: 'free', observedAt: at(400) });
  const events = run(lock, state, 401);
  assert.deepEqual(events.map(e => [e.kind, 'eventId' in e ? e.eventId : 0, 'retryAt' in e ? e.retryAt : undefined]),
    [['exceeded', 3, undefined], ['exceeded', 4, at(300)], ['cleared', 5, undefined]]);
  assert.deepEqual(run(lock, state, 402), []);
  lock.markOk({ scope: S, observedAt: at(500) }); assert.deepEqual(run(lock, state, 501), []);
});
test('SQLite events survive a restart of both stores: no duplicate, new events still arrive', t => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-zen-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { YOROI_DATA_DIR: dir };
  let lock = openZenLockStore(env), state = openDetectStateStore(env);
  assert.deepEqual(run(lock, state, 0), []);
  lock.markExceeded({ scope: S, model: 'free', observedAt: at(1), retryAt: at(60) });
  assert.deepEqual(kinds(run(lock, state, 2)), ['exceeded']);
  lock.close(); state.close(); lock = openZenLockStore(env); state = openDetectStateStore(env);
  assert.deepEqual(run(lock, state, 3), []);
  lock.markOk({ scope: S, observedAt: at(120) }); assert.deepEqual(kinds(run(lock, state, 121)), ['cleared']);
  lock.close(); state.close();
});
test('a cursor beyond the newest event (database reset) is re-initialized instead of replaying or stalling', () => {
  const state = new MemoryDetectStateStore(), lock = new MemoryZenLockStore();
  state.set('zen:cursor', '{"id":99}'); assert.deepEqual(run(lock, state, 0), []);
  lock.markExceeded({ scope: S, observedAt: at(1) }); assert.deepEqual(kinds(run(lock, state, 2)), ['exceeded']);
  state.set('zen:cursor', 'garbage'); lock.markExceeded({ scope: S, observedAt: at(3) }); assert.deepEqual(run(lock, state, 4), []);
});
test('retry-passed fires once per retry time, not before it, and re-arms after the lock clears', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  run(lock, state, 0); lock.markExceeded({ scope: S, model: 'free', observedAt: at(1), retryAt: at(60) });
  assert.deepEqual(kinds(run(lock, state, 30)), ['exceeded']);
  assert.deepEqual(run(lock, state, 60), []);
  const passed = run(lock, state, 61); assert.deepEqual(passed.map(e => [e.kind, 'retryAt' in e ? e.retryAt : '']), [['retry-passed', at(60)]]);
  assert.deepEqual(run(lock, state, 90), []);
  lock.markOk({ scope: S, observedAt: at(100) }); assert.deepEqual(kinds(run(lock, state, 101)), ['cleared']);
  lock.markExceeded({ scope: S, observedAt: at(110), retryAt: at(120) });
  assert.deepEqual(kinds(run(lock, state, 130)), ['exceeded', 'retry-passed']);
});
test('plugin-stale needs an OpenCode start older than the grace with no load since; once per start; cleared by a load', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  assert.deepEqual(run(lock, state, 100), []);
  assert.deepEqual(run(lock, state, 105, 100), []);
  const never = run(lock, state, 111, 100); assert.deepEqual(never.map(e => [e.kind, 'loadedAt' in e]), [['plugin-stale', false]]);
  assert.deepEqual(run(lock, state, 130, 100), []); assert.deepEqual(run(lock, state, 131), []); assert.deepEqual(run(lock, state, 132, 100), []);
  lock.markLoaded({ scope: S, observedAt: at(101) }); assert.deepEqual(run(lock, state, 140, 100), []);
  const old = run(lock, state, 300, 200); assert.deepEqual(old.map(e => [e.kind, 'loadedAt' in e && e.loadedAt === at(101)]), [['plugin-stale', true]]);
  lock.markLoaded({ scope: S, observedAt: at(201) }); assert.deepEqual(run(lock, state, 310, 200), []);
  assert.equal(state.get('zen:plugin-stale'), undefined);
});
test('events never carry lock reasons or unsafe text, and legacy stores without event reads still work', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore(), secret = 'synthetic-secret-token';
  run(lock, state, 0);
  lock.markExceeded({ scope: S, model: `bad model ${secret}\n`, reason: `reason ${secret}`, observedAt: at(1), retryAt: 'not-a-date' });
  lock.markExceeded({ scope: S, model: 'free', reason: secret, observedAt: at(2), retryAt: at(5) });
  const events = run(lock, state, 10), allowed = new Set(['kind', 'eventId', 'observedAt', 'model', 'retryAt']);
  assert.deepEqual(kinds(events), ['exceeded', 'exceeded', 'retry-passed']);
  for (const event of events) for (const key of Object.keys(event)) assert.ok(allowed.has(key), key);
  assert.ok(!JSON.stringify(events).includes(secret));
  const legacy: ZenLockStore = { get: () => undefined, markExceeded: () => { throw Error(); }, markOk: () => ({ changed: false }), close() {} };
  assert.deepEqual(run(legacy, state, 20), []);
  assert.throws(() => detectZen({ lock, state, nowMs: Number.NaN, pluginStaleGraceMs: 1 }), RangeError);
  assert.throws(() => detectZen({ lock, state, nowMs: 1, pluginStaleGraceMs: -1 }), RangeError);
});

test('D3: the same OpenCode start and load state reports plugin-stale once, not once per detector restart', () => {
  const lock = new MemoryZenLockStore(), state = new MemoryDetectStateStore();
  assert.deepEqual(kinds(run(lock, state, 20, 0)), ['plugin-stale'], 'first detector process sees it once');
  assert.deepEqual(run(lock, state, 21, 0), [], 'a pm2 restart must not replay it');
  assert.deepEqual(run(lock, state, 59, 0), [], 'nor later, same load state');
  lock.markLoaded({ scope: S, observedAt: at(25) }); assert.deepEqual(run(lock, state, 30, 0), [], 'loaded is not stale');
  assert.deepEqual(kinds(run(lock, state, 70, 55)), ['plugin-stale'], 'a new unloaded OpenCode is a new event'); });
test('D3: a restarted detector sees the persisted mark and stays silent with a real SQLite store', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-zen-stale-')), env = { YOROI_DATA_DIR: dir };
  const lock = openZenLockStore(env), state = openDetectStateStore(env);
  try { assert.deepEqual(kinds(run(lock, state, 20, 0)), ['plugin-stale']); state.close();
    const reopened = openDetectStateStore(env);   // the detector restarted under pm2
    try { assert.deepEqual(run(lock, reopened, 21, 0), [], 'the mark survives the restart'); }
    finally { reopened.close(); } } finally { lock.close(); rmSync(dir, { recursive: true, force: true }); } });
