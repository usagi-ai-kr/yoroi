import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SourceError } from '../app/usage-source.js';
import { loadSqlite } from './sqlite/database.js';

/** 로컬 OpenCode xAI OAuth 자격 읽기(전용·갱신 없음·값 출력 없음). credential DB 우선, auth.json 폴백. */
export interface XaiAuth {
  readonly token: string;
  readonly expiresAtMs: number;
  readonly source: 'credential-db' | 'auth.json';
}
const EXPIRY_MARGIN_MS = 60_000;

/** xAI 인증 실패(만료·자격 없음·401/403) 공통 오류: 기존 문구를 유지한 채 OpenCode 복구 안내만 덧붙인다(코드·분기 불변, 토큰·경로 없음). */
export function xaiAuthError(): SourceError {
  const error = new SourceError('authentication');
  error.message = `${error.message}; use a grok model once in OpenCode or run opencode auth login to sign in again`;
  return error;
}

const toMs = (epoch: number): number => (epoch > 1e11 ? Math.round(epoch) : Math.round(epoch * 1000));
const finish = (token: string, epoch: number, source: XaiAuth['source'], now: number): XaiAuth => {
  const expiresAtMs = toMs(epoch);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs - EXPIRY_MARGIN_MS <= now) throw xaiAuthError();
  return { token, expiresAtMs, source };
};

/** 읽기 전용 credential DB에서 활성 xai OAuth 행 1건. 행 부재/형식 오류만 auth.json 폴백(undefined), DB 장애는 fail-closed. */
function fromCredentialDb(dbPath: string, now: number): XaiAuth | undefined {
  if (!existsSync(dbPath)) return undefined;
  let db: { prepare(sql: string): { get(): unknown }; close(): void };
  try { db = new (loadSqlite().DatabaseSync)(dbPath, { readOnly: true }); }
  catch { throw new SourceError('unavailable'); }
  try {
    const row = db.prepare(`SELECT json_extract(value,'$.type') AS type, json_extract(value,'$.access') AS access,
      json_extract(value,'$.expires') AS expires FROM credential
      WHERE integration_id='xai' OR connector_id='xai'
      ORDER BY CASE WHEN active=1 THEN 0 ELSE 1 END, time_updated DESC LIMIT 1`).get() as
      { type?: unknown; access?: unknown; expires?: unknown } | undefined;
    if (!row) return undefined;
    if (row.type !== 'oauth' || typeof row.access !== 'string' || !row.access ||
      typeof row.expires !== 'number') return undefined;
    return finish(row.access, row.expires, 'credential-db', now);
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError('unavailable');
  } finally { db.close(); }
}

function fromAuthJson(authPath: string, now: number): XaiAuth {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(authPath, 'utf8')); } catch { throw xaiAuthError(); }
  const xai = (parsed as { xai?: { type?: unknown; access?: unknown; expires?: unknown } })?.xai;
  if (xai?.type !== 'oauth' || typeof xai.access !== 'string' || !xai.access || typeof xai.expires !== 'number')
    throw xaiAuthError();
  return finish(xai.access, xai.expires, 'auth.json', now);
}

/** dataDir 미지정 시 OpenCode 기본 데이터 디렉터리. 만료(1분 여유)·형식 오류는 SourceError('authentication'). */
export function readXaiAuth(options: { now?: number; dataDir?: string } = {}): XaiAuth {
  const now = options.now ?? Date.now();
  const dir = options.dataDir ?? join(homedir(), '.local', 'share', 'opencode');
  return fromCredentialDb(join(dir, 'opencode.db'), now) ?? fromAuthJson(join(dir, 'auth.json'), now);
}
