import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ZEN_FREE_SCOPE, type ZenLockStore } from '../src/app/zen-lock-port.js';
import { openDatabase } from '../src/infra/sqlite/database.js';
import { openZenLockStore } from '../src/infra/sqlite/zen-lock-store.js';

function withStore(run: (store: ZenLockStore, env: NodeJS.ProcessEnv) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-lock-'));
  const env = { YOROI_DATA_DIR: root };
  const store = openZenLockStore(env);
  try { run(store, env); } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
}

const t = (n: number) => `2026-10-10T00:00:${String(n).padStart(2, '0')}.000Z`;

test('get is undefined until a lock is recorded', () => {
  withStore(store => assert.equal(store.get(ZEN_FREE_SCOPE), undefined));
});

test('markExceeded locks and keeps the first lockedAt on repeats', () => {
  withStore(store => {
    const first = store.markExceeded({ scope: ZEN_FREE_SCOPE, model: 'm1', reason: 'Free usage exceeded', observedAt: t(1), retryAt: t(30) });
    assert.deepEqual(first, { scope: ZEN_FREE_SCOPE, state: 'locked', model: 'm1', reason: 'Free usage exceeded',
      lockedAt: t(1), retryAt: t(30), updatedAt: t(1) });
    const again = store.markExceeded({ scope: ZEN_FREE_SCOPE, observedAt: t(5) });
    assert.equal(again.lockedAt, t(1));
    assert.equal(again.updatedAt, t(5));
    assert.equal(again.retryAt, t(30));
  });
});

test('markOk clears only a locked scope and is otherwise a no-op', () => {
  withStore(store => {
    assert.deepEqual(store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(1) }), { changed: false });
    assert.equal(store.get(ZEN_FREE_SCOPE), undefined);
    store.markExceeded({ scope: ZEN_FREE_SCOPE, observedAt: t(2) });
    const cleared = store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(3) });
    assert.equal(cleared.changed, true);
    assert.equal(cleared.state?.state, 'clear');
    assert.equal(cleared.state?.clearedAt, t(3));
    const repeat = store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(4) });
    assert.equal(repeat.changed, false);
    assert.equal(repeat.state?.clearedAt, t(3));
    assert.equal(store.get(ZEN_FREE_SCOPE)?.updatedAt, t(4));
  });
});

test('state persists across reopen and events keep only the latest 200', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-lock-'));
  const env = { YOROI_DATA_DIR: root };
  try {
    const store = openZenLockStore(env);
    for (let i = 0; i < 250; i += 1) store.markExceeded({ scope: ZEN_FREE_SCOPE, observedAt: new Date(Date.UTC(2026, 9, 10, 0, 0, i)).toISOString() });
    store.close();
    const reopened = openZenLockStore(env);
    assert.equal(reopened.get(ZEN_FREE_SCOPE)?.state, 'locked');
    reopened.close();
    const db = openDatabase(join(root, 'yoroi.db'));
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM lock_events').get() as { n: number }).n, 200);
    db.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a late --ok older than the latest exceeded keeps the lock; a missing retryAt keeps the known one', () => {
  withStore(store => {
    store.markExceeded({ scope: ZEN_FREE_SCOPE, observedAt: t(10), retryAt: t(50) });
    store.markExceeded({ scope: ZEN_FREE_SCOPE, observedAt: t(20) });
    assert.equal(store.get(ZEN_FREE_SCOPE)?.retryAt, t(50));
    const late = store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(15) });
    assert.equal(late.changed, false);
    assert.equal(late.state?.state, 'locked');
    assert.equal(store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(20) }).changed, true);
    const relocked = store.markExceeded({ scope: ZEN_FREE_SCOPE, observedAt: t(30) });
    assert.equal(relocked.retryAt, undefined);
    assert.equal(store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: '2026-10-10T00:00:40Z' }).changed, true);
  });
});

test('a late exceeded does not move the latest observation back, so the stale --ok check holds', () => {
  withStore(store => {
    store.markExceeded({ scope: ZEN_FREE_SCOPE, model: 'new', observedAt: t(0) });
    store.markExceeded({ scope: ZEN_FREE_SCOPE, model: 'new', observedAt: t(20), retryAt: t(60) });
    const late = store.markExceeded({ scope: ZEN_FREE_SCOPE, model: 'old', observedAt: t(10), retryAt: t(30) });
    assert.deepEqual([late.lockedAt, late.updatedAt, late.model, late.retryAt], [t(0), t(20), 'new', t(60)]);
    assert.equal(store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(15) }).changed, false);
    assert.equal(store.get(ZEN_FREE_SCOPE)?.state, 'locked');
    assert.equal(store.markOk({ scope: ZEN_FREE_SCOPE, observedAt: t(21) }).changed, true);
  });
});
