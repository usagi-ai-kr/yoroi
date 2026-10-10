import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ZEN_FREE_SCOPE, type ZenLockStore } from '../src/app/zen-lock-port.js';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';

type Event = { kind: 'exceeded' | 'ok'; at: string; model: string };
const S = ZEN_FREE_SCOPE;
const t = (n: number) => new Date(Date.UTC(2026, 9, 10, 0, 0, n)).toISOString();

function eachStore(run: (open: () => ZenLockStore) => void): void {
  run(() => new MemoryZenLockStore());
  const root = mkdtempSync(join(tmpdir(), 'yoroi-order-'));
  let n = 0;
  const stores: ZenLockStore[] = [];
  try {
    run(() => { const s = openZenLockStore({ YOROI_DATA_DIR: join(root, String(n++)) }); stores.push(s); return s; });
  } finally { stores.forEach(s => s.close()); rmSync(root, { recursive: true, force: true }); }
}
const apply = (store: ZenLockStore, e: Event) => e.kind === 'exceeded'
  ? store.markExceeded({ scope: S, model: e.model, observedAt: e.at })
  : store.markOk({ scope: S, model: e.model, observedAt: e.at });

test('late exceeded/ok never move updatedAt back or flip state (p3 reproductions)', () => {
  eachStore(open => {
    const store = open();
    store.markExceeded({ scope: S, observedAt: t(0) });
    store.markExceeded({ scope: S, observedAt: t(20) });
    assert.equal(store.markExceeded({ scope: S, observedAt: t(10) }).updatedAt, t(20));
    assert.equal(store.markOk({ scope: S, observedAt: t(15) }).changed, false);
    assert.equal(store.get(S)?.state, 'locked');
    assert.equal(store.markOk({ scope: S, observedAt: t(21) }).changed, true);
    const late = store.markExceeded({ scope: S, observedAt: t(10) });
    assert.deepEqual([late.state, late.updatedAt, late.clearedAt], ['clear', t(21), t(21)]);
    assert.equal(store.markOk({ scope: S, observedAt: t(25) }).changed, false);
    assert.equal(store.markExceeded({ scope: S, observedAt: t(23) }).state, 'clear');
  });
});

test('any arrival order ends in the state of chronological application (seeded)', () => {
  let seed = 20261010;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  eachStore(open => {
    for (let round = 0; round < 40; round += 1) {
      const rest: Event[] = Array.from({ length: 8 }, (_, i) =>
        ({ kind: rand() < 0.5 ? 'exceeded' : 'ok', at: t(i + 1), model: `m${i + 1}` }));
      const first: Event = { kind: 'exceeded', at: t(0), model: 'm0' };
      const chrono = open(); [first, ...rest].forEach(e => apply(chrono, e));
      const shuffled = [...rest];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      const store = open(); let latest = '';
      for (const e of [first, ...shuffled]) {
        const before = store.get(S);
        apply(store, e);
        const after = store.get(S)!;
        assert.ok(after.updatedAt >= latest, 'updatedAt must be monotone');
        if (before && e.at < before.updatedAt) assert.deepEqual(after, before, 'late events leave state unchanged');
        latest = after.updatedAt;
      }
      const [want, got] = [chrono.get(S)!, store.get(S)!];
      assert.deepEqual([got.state, got.updatedAt], [want.state, want.updatedAt]);
      if (want.state === 'locked') assert.equal(got.model, want.model);
    }
  });
});
