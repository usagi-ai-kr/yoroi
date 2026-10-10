import assert from 'node:assert/strict';
import test from 'node:test';
import { getZenLock, markZenExceeded, markZenOk } from '../src/app/zen-lock.js';
import { ZEN_FREE_SCOPE } from '../src/app/zen-lock-port.js';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';

test('Zen lock records exceeded state and preserves its original lock time', () => {
  const store = new MemoryZenLockStore();
  const first = markZenExceeded(store, { observedAt: '2026-10-10T00:00:00Z', model: 'free' });
  assert.equal(first.scope, ZEN_FREE_SCOPE);
  const next = markZenExceeded(store, { observedAt: '2026-10-10T01:00:00Z', reason: 'limit' });
  assert.equal(next.lockedAt, first.lockedAt);
  assert.equal(getZenLock(store)?.reason, 'limit');
});

test('Zen lock clears only an existing lock and does not expose mutable state', () => {
  const store = new MemoryZenLockStore();
  assert.deepEqual(markZenOk(store, { observedAt: '2026-10-10T00:00:00Z' }), { changed: false });
  markZenExceeded(store, { observedAt: '2026-10-10T00:00:00Z' });
  const cleared = markZenOk(store, { observedAt: '2026-10-10T01:00:00Z' });
  assert.equal(cleared.changed, true);
  assert.equal(cleared.state?.state, 'clear');
  if (cleared.state) cleared.state.state = 'locked';
  assert.equal(getZenLock(store)?.state, 'clear');
});

test('memory store matches SQLite: late --ok is ignored and retryAt survives a timeless exceeded', () => {
  const store = new MemoryZenLockStore();
  markZenExceeded(store, { observedAt: '2026-10-10T00:00:10.000Z', retryAt: '2026-10-10T00:00:50.000Z' });
  markZenExceeded(store, { observedAt: '2026-10-10T00:00:20.000Z' });
  assert.equal(getZenLock(store)?.retryAt, '2026-10-10T00:00:50.000Z');
  assert.equal(markZenOk(store, { observedAt: '2026-10-10T00:00:15.000Z' }).changed, false);
  assert.equal(getZenLock(store)?.state, 'locked');
  assert.equal(markZenOk(store, { observedAt: '2026-10-10T00:00:20.000Z' }).changed, true);
  assert.equal(markZenExceeded(store, { observedAt: '2026-10-10T00:00:30.000Z' }).retryAt, undefined);
});

test('memory store: a late exceeded keeps the newest observation and the lock against a stale --ok', () => {
  const store = new MemoryZenLockStore();
  markZenExceeded(store, { observedAt: '2026-10-10T00:00:00Z', model: 'new' });
  markZenExceeded(store, { observedAt: '2026-10-10T00:00:20Z', model: 'new', retryAt: '2026-10-10T00:01:00Z' });
  const late = markZenExceeded(store, { observedAt: '2026-10-10T00:00:10Z', model: 'old', retryAt: '2026-10-10T00:00:30Z' });
  assert.deepEqual([late.lockedAt, late.updatedAt, late.model, late.retryAt],
    ['2026-10-10T00:00:00Z', '2026-10-10T00:00:20Z', 'new', '2026-10-10T00:01:00Z']);
  assert.equal(markZenOk(store, { observedAt: '2026-10-10T00:00:15Z' }).changed, false);
  assert.equal(getZenLock(store)?.state, 'locked');
});
