import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceError } from '../src/app/usage-source.js';
import { NodeHttpClient } from '../src/infra/http-client.js';
import { XaiBillingSource } from '../src/infra/xai-billing-source.js';
import { readXaiAuth } from '../src/infra/xai-auth.js';
import { loadSqlite } from '../src/infra/sqlite/database.js';
import { renderResult } from '../src/ui/cli/display.js';
import { createSnapshot } from '../src/domain/usage.js';

const fixture = JSON.stringify({ config: { creditUsagePercent: 30, currentPeriod: {
  type: 'USAGE_PERIOD_TYPE_WEEKLY', start: '2026-10-10T00:00:00Z', end: '2026-10-17T00:00:00Z' } } });

test('XaiBillingSource는 XaiBillingClient에 위임하여 스냅샷을 반환한다', async () => {
  const fetcher = async () => new Response(fixture, { status: 200 });
  const source = new XaiBillingSource(new NodeHttpClient(fetcher), () => ({ token: 'synthetic-token' }),
    1000, () => '2026-10-15T00:00:00Z');
  assert.equal(source.provider, 'xai');
  const snap = await source.read();
  assert.equal(snap.provider, 'xai');
  assert.equal(snap.windows[0]?.id, 'weekly');
  assert.equal(snap.windows[0]?.percent, 30);
});

test('xai-auth: DB 파일 손상/쿼리 실패 시 auth.json으로 폴백하지 않고 fail-closed(unavailable)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xai-auth-corrupt-'));
  try {
    writeFileSync(join(dir, 'opencode.db'), 'not a sqlite database');
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ xai: { type: 'oauth', access: 'fallback-token', expires: Date.now() + 1e7 } }));
    assert.throws(() => readXaiAuth({ dataDir: dir }), (err: unknown) => err instanceof SourceError && err.code === 'unavailable');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('xai-auth: DB 만료 토큰은 auth.json으로 폴백하지 않고 fail-closed(authentication)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xai-auth-expired-'));
  try {
    const db = new (loadSqlite().DatabaseSync)(join(dir, 'opencode.db'));
    db.exec(`CREATE TABLE credential (integration_id TEXT, connector_id TEXT, active INTEGER, time_updated INTEGER, value TEXT);
      INSERT INTO credential VALUES ('xai', 'xai', 1, 1000, '{"type":"oauth","access":"expired","expires":100}');`);
    db.close();
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ xai: { type: 'oauth', access: 'fallback-token', expires: Date.now() + 1e7 } }));
    assert.throws(() => readXaiAuth({ dataDir: dir, now: Date.now() }), (err: unknown) => err instanceof SourceError && err.code === 'authentication');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('xai-auth: DB 행 부재 시 auth.json으로 정상 폴백한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'xai-auth-fallback-'));
  try {
    const db = new (loadSqlite().DatabaseSync)(join(dir, 'opencode.db'));
    db.exec('CREATE TABLE credential (integration_id TEXT, connector_id TEXT, active INTEGER, time_updated INTEGER, value TEXT);');
    db.close();
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ xai: { type: 'oauth', access: 'valid-token', expires: Date.now() + 1e7 } }));
    const auth = readXaiAuth({ dataDir: dir, now: Date.now() });
    assert.equal(auth.token, 'valid-token');
    assert.equal(auth.source, 'auth.json');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('보완2: 비-WEEKLY fallback usage id 창이 렌더링에 정상 표시된다', () => {
  const snap = createSnapshot('xai', '2026-10-15T00:00:00Z', [
    { id: 'usage', unit: 'percent', percent: 55, resetAt: '2026-10-22T00:00:00Z' }
  ]);
  const lines = renderResult({ provider: 'xai', snapshot: snap });
  assert.ok(lines.some(l => l.includes('- usage [percent]')));
  assert.ok(lines.some(l => l.includes('percent=55')));
});
