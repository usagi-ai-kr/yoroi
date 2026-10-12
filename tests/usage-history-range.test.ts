import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { UsageHistoryContext } from '../src/app/usage-history-port.js';
import { createSnapshot } from '../src/domain/usage.js';
import { loadSqlite } from '../src/infra/sqlite/database.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../src/infra/sqlite/usage-history-store.js';

const start = Date.parse('2026-10-10T00:00:00.000Z');
const at = (offset: number) => new Date(start + offset).toISOString();
const ctxA: UsageHistoryContext = { scope: 'scope-a', contractVersion: 'claude@1' };
const ctxB: UsageHistoryContext = { scope: 'scope-b', contractVersion: 'codex@1' };

function withDb(run: (history: SqliteUsageHistory, path: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-hist-range-'));
  const path = join(root, 'yoroi.db');
  const history = new SqliteUsageHistory(openUsageDatabase(path), true);
  try { run(history, path); } finally { history.close(); rmSync(root, { recursive: true, force: true }); }
}

test('queryObservations returns empty array on empty database or when filtered out', () => withDb(h => {
  assert.deepEqual(h.queryObservations(), []);
  assert.deepEqual(h.queryObservations({ sinceIso: at(0) }), []);
}));

test('queryObservations filters by sinceIso, provider, and windowId correctly', () => withDb(h => {
  h.record(createSnapshot('claude', at(1_000), [{ id: '5h', unit: 'percent', percent: 10 }]), ctxA);
  h.record(createSnapshot('claude', at(2_000), [{ id: '5h', unit: 'percent', percent: 20 }]), ctxA);
  h.record(createSnapshot('claude', at(3_000), [{ id: '1d', unit: 'percent', percent: 30 }]), ctxA);
  h.record(createSnapshot('codex', at(2_000), [{ id: '5h', unit: 'percent', percent: 40 }]), ctxB);

  // All observations
  const all = h.queryObservations();
  assert.equal(all.length, 4);

  // Filter by sinceIso
  const since2000 = h.queryObservations({ sinceIso: at(2_000) });
  assert.equal(since2000.length, 3);
  assert.ok(since2000.every(o => o.observedAt >= at(2_000)));

  // Filter by provider
  const claudeOnly = h.queryObservations({ provider: 'claude' });
  assert.equal(claudeOnly.length, 3);
  assert.ok(claudeOnly.every(o => o.provider === 'claude'));

  // Filter by windowId
  const window5h = h.queryObservations({ windowId: '5h' });
  assert.equal(window5h.length, 3);
  assert.ok(window5h.every(o => o.window.id === '5h'));

  // Combined filters
  const combined = h.queryObservations({ sinceIso: at(2_000), provider: 'claude', windowId: '5h' });
  assert.equal(combined.length, 1);
  assert.equal(combined[0]?.provider, 'claude');
  assert.equal(combined[0]?.window.id, '5h');
  assert.equal(combined[0]?.observedAt, at(2_000));
  assert.equal(combined[0]?.window.percent, 20);
}));

test('queryObservations orders samples chronologically (ASC) per series', () => withDb(h => {
  // Insert out of chronological order
  h.record(createSnapshot('claude', at(3_000), [{ id: '5h', unit: 'percent', percent: 30 }]), ctxA);
  h.record(createSnapshot('claude', at(1_000), [{ id: '5h', unit: 'percent', percent: 10 }]), ctxA);
  h.record(createSnapshot('claude', at(2_000), [{ id: '5h', unit: 'percent', percent: 20 }]), ctxA);

  const res = h.queryObservations({ provider: 'claude', windowId: '5h' });
  assert.deepEqual(res.map(o => o.observedAt), [at(1_000), at(2_000), at(3_000)]);
  assert.deepEqual(res.map(o => o.window.percent), [10, 20, 30]);
}));

test('queryObservations surfaces BUSY to the caller (empty result must not mask it) and rethrows other errors', () => {
  const busyErr = new Error('database is locked') as Error & { errcode: number };
  busyErr.errcode = 5;
  const busyDb = { prepare: () => ({ all: () => { throw busyErr; } }) } as unknown as import('node:sqlite').DatabaseSync;
  const busyHist = new SqliteUsageHistory(busyDb);
  assert.throws(() => busyHist.queryObservations(), (error: unknown) => (error as { errcode?: number }).errcode === 5);

  const diskErr = new Error('disk failure') as Error & { errcode: number };
  diskErr.errcode = 10;
  const errDb = { prepare: () => ({ all: () => { throw diskErr; } }) } as unknown as import('node:sqlite').DatabaseSync;
  const errHist = new SqliteUsageHistory(errDb);
  assert.throws(() => errHist.queryObservations(), /disk failure/);
});
