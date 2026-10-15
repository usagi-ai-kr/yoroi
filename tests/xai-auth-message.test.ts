import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceError } from '../src/app/usage-source.js';
import { NodeHttpClient } from '../src/infra/http-client.js';
import { XaiBillingClient } from '../src/infra/xai-billing-client.js';
import { readXaiAuth } from '../src/infra/xai-auth.js';
import { loadSqlite } from '../src/infra/sqlite/database.js';

/** 근거: scratch/reports/yoroi-xai-auth-diag-w4.json — 만료·자격 없음·401/403은 OpenCode 복구 안내를 붙인다. */
const BASE = 'Authentication is required';
const GUIDANCE = /use a grok model once in OpenCode or run opencode auth login/;

/** 코드·문구 관례(기존 문구 유지 + 안내)·비노출(토큰·경로)을 한 번에 검증한다. */
function expectAuth(error: unknown, forbidden: readonly string[] = []): SourceError {
  assert.ok(error instanceof SourceError, 'SourceError 인스턴스여야 한다');
  assert.equal(error.code, 'authentication', '오류 코드는 불변');
  assert.ok(error.message.startsWith(BASE), '기존 SourceError 문구를 유지한다');
  assert.match(error.message, GUIDANCE, 'OpenCode 복구 안내를 포함한다');
  for (const secret of forbidden) assert.ok(!error.message.includes(secret), `메시지에 미노출: ${secret}`);
  return error;
}

function capture(run: () => unknown, forbidden?: readonly string[]): SourceError {
  try { run(); } catch (error) { return expectAuth(error, forbidden); }
  assert.fail('authentication 오류가 발생해야 한다');
}

async function captureAsync(run: () => Promise<unknown>, forbidden?: readonly string[]): Promise<SourceError> {
  try { await run(); } catch (error) { return expectAuth(error, forbidden); }
  assert.fail('authentication 오류가 발생해야 한다');
}

const tempDir = (): string => mkdtempSync(join(tmpdir(), 'xai-auth-msg-'));

test('만료 자격(credential DB): 안내가 붙고 토큰·경로는 노출되지 않는다', () => {
  const dir = tempDir();
  try {
    const db = new (loadSqlite().DatabaseSync)(join(dir, 'opencode.db'));
    db.exec(`CREATE TABLE credential (integration_id TEXT, connector_id TEXT, active INTEGER, time_updated INTEGER, value TEXT);
      INSERT INTO credential VALUES ('xai', 'xai', 1, 1000, '{"type":"oauth","access":"expired-synthetic","expires":100}');`);
    db.close();
    capture(() => readXaiAuth({ dataDir: dir, now: Date.now() }), ['expired-synthetic', dir]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('자격 없음(auth.json 부재): 안내 포함 authentication', () => {
  const dir = tempDir();
  try { capture(() => readXaiAuth({ dataDir: dir, now: Date.now() }), [dir]); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});

test('자격 형식 오류(auth.json 비 oauth): 안내 포함 authentication, 키 값 미노출', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'auth.json'), JSON.stringify({ xai: { type: 'api-key', access: 'synthetic-key' } }));
    capture(() => readXaiAuth({ dataDir: dir, now: Date.now() }), ['synthetic-key', dir]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('HTTP 401/403: 안내 포함 authentication, 토큰 미노출', async () => {
  const client = (status: number): XaiBillingClient => new XaiBillingClient(
    new NodeHttpClient(async () => new Response('{}', { status })),
    () => ({ token: 'synthetic-token' }), 500, () => '2026-10-15T00:00:00Z');
  for (const status of [401, 403])
    await captureAsync(() => client(status).read(), ['synthetic-token']);
});

test('분기 불변: DB 장애는 unavailable 문구 그대로이고 auth 안내를 붙이지 않는다', () => {
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'opencode.db'), 'not a sqlite database');
    try { readXaiAuth({ dataDir: dir, now: Date.now() }); assert.fail('unavailable 오류가 발생해야 한다'); }
    catch (error) {
      assert.ok(error instanceof SourceError, 'SourceError 인스턴스여야 한다');
      assert.equal(error.code, 'unavailable', 'DB 장애 분기는 불변');
      assert.ok(!error.message.includes('grok model once'), 'auth 안내는 authentication 전용');
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
