import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { UsageHistoryContext, UsageHistoryKey } from '../src/app/usage-history-port.js';
import { createSnapshot, type UsageWindow } from '../src/domain/usage.js';
import { loadSqlite, openDatabase } from '../src/infra/sqlite/database.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../src/infra/sqlite/usage-history-store.js';

const start = Date.parse('2026-10-10T00:00:00.000Z');
const ctx: UsageHistoryContext = { scope: 'profile-a', contractVersion: 'claude@1' };
const q: UsageHistoryKey = { ...ctx, provider: 'claude', windowId: '5h', unit: 'percent' };
const at = (offset: number) => new Date(start + offset).toISOString();
const snap = (offset: number, windows: UsageWindow[] = [{ id: '5h', unit: 'percent', percent: 20 }]) =>
  createSnapshot('claude', at(offset), windows);
function withDb(run: (history: SqliteUsageHistory, path: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-hist-'));
  const path = join(root, 'yoroi.db'), history = new SqliteUsageHistory(openUsageDatabase(path), true);
  try { run(history, path); } finally { history.close(); rmSync(root, { recursive: true, force: true }); }
}

test('latestTwo returns the newest two real samples regardless of insertion order; duplicates are ignored', () => withDb(h => {
  assert.deepEqual(h.latestTwo(q), []);
  h.record(snap(2_000), ctx); h.record(snap(0), ctx); h.record(snap(1_000), ctx); h.record(snap(1_000), ctx);
  h.record(createSnapshot('claude', '2026-10-10T00:00:01Z', [{ id: '5h', unit: 'percent', percent: 99 }]), ctx);
  assert.deepEqual(h.latestTwo(q).map(o => o.observedAt), [at(2_000), at(1_000)]);
  assert.equal(h.latestTwo(q)[1]?.window.percent, 20);
  h.record(snap(3_000, []), ctx);
  assert.equal(h.latestTwo(q)[0]?.observedAt, at(2_000));
}));

test('windows round-trip optional fields and series are isolated by every key field', () => withDb(h => {
  const full: UsageWindow = { id: '5h', unit: 'USD', used: 1, remaining: 2, limit: 3, percent: 33.3,
    resetAt: '2026-10-10T05:00:00.000Z', periodStart: '2026-10-10T00:00:00.000Z' };
  h.record(snap(0, [full, { id: '7d', unit: 'percent' }]), ctx);
  assert.deepEqual(h.latestTwo({ ...q, unit: 'USD' })[0], { provider: 'claude', ...ctx, observedAt: at(0), window: full });
  assert.deepEqual(h.latestTwo({ ...q, windowId: '7d' })[0]?.window, { id: '7d', unit: 'percent' });
  for (const changed of [{ scope: 'other' }, { contractVersion: 'claude@2' }, { unit: 'tokens' }, { windowId: '30d' }, { provider: 'codex' as const }])
    assert.deepEqual(h.latestTwo({ ...q, unit: 'USD', ...changed }), []);
}));

test('unsafe identity is rejected and a failing window rolls the whole snapshot back', () => withDb(h => {
  for (const scope of ['Bearer abc', 'a/b', '']) assert.throws(() => h.record(snap(0), { ...ctx, scope }), RangeError);
  assert.throws(() => h.latestTwo({ ...q, contractVersion: 'bad version' }), RangeError);
  const forged = { provider: 'claude', observedAt: at(0), windows: [{ id: '5h', unit: 'percent', percent: 20 },
    { id: '7d', unit: 'percent', percent: 101 }] } as unknown as ReturnType<typeof snap>;
  assert.throws(() => h.record(forged, ctx));
  assert.deepEqual(h.latestTwo(q), []);
}));

test('prune applies the cutoff and a per-series cap, keeping slow series intact', () => withDb(h => {
  for (const offset of [0, 1_000, 2_000]) h.record(snap(offset), ctx);
  h.record(snap(-5_000, [{ id: '7d', unit: 'percent', percent: 5 }]), ctx);
  for (const bad of [0, 1.5, Number.NaN]) assert.throws(() => h.prune({ before: at(0), maxSamples: bad }), RangeError);
  assert.equal(h.prune({ before: at(-9_000), maxSamples: 2 }), 1);
  assert.deepEqual(h.latestTwo(q).map(o => o.observedAt), [at(2_000), at(1_000)]);
  assert.equal(h.latestTwo({ ...q, windowId: '7d' }).length, 1);
  assert.equal(h.prune({ before: at(1_500), maxSamples: 5 }), 2);
  assert.equal(h.latestTwo(q).length, 1);
}));

test('record reports BUSY on the short-timeout connection while latestTwo/prune degrade quietly', () => withDb((h, path) => {
  h.record(snap(0), ctx);
  const holder = new (loadSqlite().DatabaseSync)(path);
  holder.exec('BEGIN IMMEDIATE');
  try {
    assert.throws(() => h.record(snap(1_000), ctx), /locked/);
    assert.equal(h.prune({ before: at(10_000), maxSamples: 1 }), 0);
    assert.equal(h.latestTwo(q).length, 1);
  } finally { holder.exec('ROLLBACK'); holder.close(); }
  assert.equal(h.prune({ before: at(10_000), maxSamples: 1 }), 1);
}));

test('the short cache timeout applies from initialization: a v1 DB under a held write lock fails open fast', () => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-hist-')), path = join(root, 'yoroi.db');
  openDatabase(path).close();
  const holder = new (loadSqlite().DatabaseSync)(path);
  holder.exec('BEGIN IMMEDIATE');
  const began = Date.now();
  try { assert.throws(() => openUsageDatabase(path), /locked/); }
  finally { holder.exec('ROLLBACK'); holder.close(); }
  assert.ok(Date.now() - began < 1_000, 'fails within the 100ms cache timeout, not the 2000ms default');
  assert.throws(() => openDatabase(path, { busyTimeoutMs: -1 }), RangeError);
  openUsageDatabase(path).close(); rmSync(root, { recursive: true, force: true });
});
