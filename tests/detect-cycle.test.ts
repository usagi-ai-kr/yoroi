import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { leaseTtlMs, type DetectStateStore } from '../src/app/detect-state-port.js';
import { ZEN_FREE_SCOPE as S, type ZenLockStore } from '../src/app/zen-lock-port.js';
import { openUsagePersistence } from '../src/composition/cache.js';
import { runDetectCycle, type DetectCycleDeps } from '../src/composition/detect.js';
import { loadConfig } from '../src/config/load-config.js';
import { createSnapshot } from '../src/domain/usage.js';
import { openDetectStateStore } from '../src/infra/sqlite/detect-state-store.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000, INTERVAL = 5 * MIN;
function harness(t: TestContext, over: Partial<DetectCycleDeps> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-detect-cycle-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataEnv = { YOROI_DATA_DIR: dir }, env = { ...dataEnv, YOROI_PROVIDERS: 'codex' };
  const clock = { now: T0 }, opened = { state: 0, zen: 0, usage: 0, closed: 0 };
  const track = <X extends { close(): void }>(key: 'state' | 'zen' | 'usage', make: () => X) => () => { const x = make(); opened[key]++; const close = x.close.bind(x); x.close = () => { opened.closed++; close(); }; return x; };
  let reads = 0, percent = 40;
  const factories = { codex: () => ({ provider: 'codex' as const, read: async () => { reads++; return createSnapshot('codex', new Date(clock.now).toISOString(), [{ id: 'weekly', unit: 'percent', percent }]); } }) };
  const deps = (owner = 'detector-a'): DetectCycleDeps => ({ config: loadConfig(env), env, dataEnv, now: () => clock.now, owner, intervalMs: INTERVAL, platform: 'linux', factories,
    thresholds: { surgePercentPoints: 20, staleAfterMs: 45 * MIN, pluginStaleGraceMs: 10 * MIN },
    openState: track('state', () => openDetectStateStore(dataEnv)), openZen: track('zen', () => openZenLockStore(dataEnv)),
    openPersistence: track('usage', () => openUsagePersistence(dataEnv)), ...over });
  return { clock, opened, deps, dataEnv, reads: () => reads, setPercent: (v: number) => { percent = v; } };
}

test('every cycle opens and closes its own connections and renews the lease heartbeat', async t => {
  const h = harness(t);
  const first = await runDetectCycle(h.deps()); assert.deepEqual([first.events.length, first.errors.length], [0, 0]);
  assert.deepEqual(h.opened, { state: 1, zen: 1, usage: 1, closed: 3 });
  h.clock.now += INTERVAL; await runDetectCycle(h.deps());
  assert.deepEqual(h.opened, { state: 2, zen: 2, usage: 2, closed: 6 });
  const peek = openDetectStateStore(h.dataEnv); t.after(() => peek.close());
  assert.equal(peek.getLease()?.renewedAtMs, T0 + INTERVAL); assert.equal(peek.getLease()?.expiresAtMs, T0 + INTERVAL + leaseTtlMs(INTERVAL));
});
test('a second detector is skipped while the lease is live and takes over with a gap event after it expires', async t => {
  const h = harness(t); await runDetectCycle(h.deps('detector-a'));
  h.clock.now += INTERVAL; assert.equal((await runDetectCycle(h.deps('detector-b'))).skipped, 'lease-held');
  h.clock.now = T0 + leaseTtlMs(INTERVAL) + 1;
  const took = await runDetectCycle(h.deps('detector-b'));
  assert.deepEqual(took.events.filter(e => e.kind === 'detector-gap').map(e => 'gapMs' in e ? e.gapMs : 0), [leaseTtlMs(INTERVAL) + 1]);
  assert.equal(h.opened.closed, h.opened.state + h.opened.zen + h.opened.usage);
});
test('a lost lease is reported as fenced, and Zen events are delivered once across restarts', async t => {
  const h = harness(t); await runDetectCycle(h.deps());
  const zen = openZenLockStore(h.dataEnv); zen.markExceeded({ scope: S, model: 'free', observedAt: new Date(T0 + 1000).toISOString() }); zen.close();
  h.clock.now += INTERVAL; const second = await runDetectCycle(h.deps());
  assert.deepEqual(second.events.map(e => e.kind), ['exceeded']);
  h.clock.now += INTERVAL; assert.deepEqual((await runDetectCycle(h.deps())).events, []);
  const withFence = h.deps(); const open = withFence.openState!;
  const result = await runDetectCycle({ ...withFence, openState: () => { const s = open(); s.renewLease = () => false; return s; } });
  assert.equal(result.fenced, true);
});
test('each detector fails alone: Zen, usage storage and a single provider never break the rest of the cycle', async t => {
  const broken: ZenLockStore = { get: () => { throw Error('x'); }, markExceeded: () => { throw Error(); }, markOk: () => ({ changed: false }), close() {}, latestEventId: () => { throw Error(); }, eventsSince: () => [] };
  const h = harness(t);
  const a = await runDetectCycle(h.deps('detector-a')); assert.deepEqual(a.errors, []);
  const zenDown = await runDetectCycle({ ...h.deps(), openZen: () => broken }); assert.deepEqual(zenDown.errors, ['zen']);
  const zenOpenFails = await runDetectCycle({ ...h.deps(), openZen: () => { throw Error('x'); } }); assert.deepEqual(zenOpenFails.errors, ['zen']);
  h.clock.now += 40 * MIN; h.setPercent(100);
  const usageDown = await runDetectCycle({ ...h.deps(), openPersistence: () => { throw Error('x'); } }); assert.deepEqual(usageDown.errors, ['usage:open']);
  const zenDownUsageOk = await runDetectCycle({ ...h.deps(), openZen: () => broken });
  assert.deepEqual([zenDownUsageOk.errors, zenDownUsageOk.events.map(e => e.kind)], [['zen'], ['exhausted', 'surge']]);
  const stateDown = await runDetectCycle({ ...h.deps(), openState: () => { throw Error('x'); } }); assert.deepEqual([stateDown.errors, stateDown.events], [['state:open'], []]);
  assert.equal(h.reads(), 2);
});
