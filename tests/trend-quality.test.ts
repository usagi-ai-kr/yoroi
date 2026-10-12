import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { computeTrendStats, type TrendObservation } from '../src/domain/trend-calc.js';
import { renderTrendPretty, renderTrendText, type SeriesTrendResult } from '../src/ui/cli/trend-render.js';
import { runTrendCli } from '../src/composition/trend-cli.js';
import { openUsageDatabase } from '../src/infra/sqlite/usage-cache-store.js';
import { openUsageHistory, openUsageHistoryReadonly } from '../src/infra/sqlite/usage-history-store.js';
import type { UsageHistory } from '../src/app/usage-history-port.js';

const obs = (at: string, percent: number, resetAt = '2026-10-11T00:00:00Z'): TrendObservation => ({
  provider: 'claude', scope: 'main', contractVersion: 'v1', observedAt: at,
  window: { id: '5h', unit: 'percent', percent, resetAt } });
const result = (unit: string, periods: SeriesTrendResult['periods']): SeriesTrendResult =>
  ({ provider: 'claude', windowId: '5h', unit, contractVersion: 'v1', periods });

test('percent deltas render as %p in text and pretty while JSON keeps raw numbers and unit', () => {
  const stats = computeTrendStats([obs('2026-10-10T00:00:00Z', 10), obs('2026-10-10T02:00:00Z', 22)], '24h',
    Date.parse('2026-10-10T02:00:00Z'));
  const text = renderTrendText([result('percent', { '24h': stats })], '24h').join('\n');
  assert.match(text, /delta=\+12%p/, text);
  assert.match(text, /rate=\+6%p\/h/, text);
  const pretty = renderTrendPretty([result('percent', { '24h': stats })]).join('\n');
  assert.match(pretty, /Δ\+12%p/);
});
test('a gap covering at least half the period flags the rate without changing values or interpolating', () => {
  const now = Date.parse('2026-10-10T00:00:00Z');
  const gapped = computeTrendStats([obs('2026-10-04T00:00:00Z', 10), obs('2026-10-09T00:00:00Z', 40)], '7d', now);
  assert.equal(gapped.delta, 30); assert.equal(gapped.ratePerHour, 0.25); assert.equal(gapped.gaps, 1);
  assert.equal(gapped.gapWarning, true);
  assert.match(renderTrendText([result('percent', { '7d': gapped })]).join('\n'), /gap=warning/);
  const tight = computeTrendStats([obs('2026-10-09T22:00:00Z', 10), obs('2026-10-10T00:00:00Z', 20)], '7d', now);
  assert.ok(!tight.gapWarning);
});
test('readonly open queries history and refuses writes; missing DB throws for the caller to map to exit 0', t => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-trend-ro-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { YOROI_DATA_DIR: dir } as NodeJS.ProcessEnv;
  const writer = openUsageDatabase(join(dir, 'yoroi.db'));
  writer.prepare('INSERT INTO observation_samples (provider, account_scope, contract_version, window_id, unit, observed_at, period_start, reset_at, used, remaining, limit_value, percent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('claude', 'main', 'v1', '5h', 'percent', '2026-10-10T00:00:00.000Z', null, null, null, null, null, 10);
  writer.close();
  const ro = openUsageHistoryReadonly(env);
  try {
    const rows = ro.queryObservations!({ sinceIso: '2026-10-01T00:00:00.000Z' });
    assert.equal(rows.length, 1);
    assert.throws(() => (ro as unknown as { db: { exec(sql: string): void } }).db.exec('CREATE TABLE x (id INTEGER)'));
  } finally { ro.close(); }
  assert.throws(() => openUsageHistoryReadonly({ YOROI_DATA_DIR: join(dir, 'missing') } as NodeJS.ProcessEnv));
  const rw = openUsageHistory(env); rw.close();
});
test('a BUSY query maps to exit 1, and an unsupported history errors explicitly', async () => {
  const stdout: string[] = [], stderr: string[] = [];
  const env = { stdout: (line: string) => stdout.push(line), stderr: (line: string) => stderr.push(line) };
  const busy: UsageHistory = { record: () => {}, latestTwo: () => [], queryObservations: () => { throw Object.assign(new Error('busy'), { errcode: 5 }); }, prune: () => 0, close: () => {} };
  const busyCode = await runTrendCli({ kind: 'trend', since: '7d' },
    { env, dataEnv: { YOROI_DATA_DIR: '/nonexistent' } as NodeJS.ProcessEnv, openHistory: () => busy });
  assert.equal(busyCode, 1); assert.match(stderr.join(''), /storage busy/i);
  stdout.length = 0; stderr.length = 0;
  const bare: UsageHistory = { record: () => {}, latestTwo: () => [], prune: () => 0, close: () => {} };
  const code = await runTrendCli({ kind: 'trend', since: '7d' },
    { env, dataEnv: { YOROI_DATA_DIR: '/nonexistent' } as NodeJS.ProcessEnv, openHistory: () => bare });
  assert.equal(code, 1); assert.match(stderr.join(''), /unsupported/i); assert.equal(stdout.length, 0);
});
