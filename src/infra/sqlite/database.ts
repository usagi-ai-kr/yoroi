import { chmodSync, closeSync, existsSync, openSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { ensureDataDir } from './data-dir.js';
import { migrate, type Migration } from './migrations.js';

type SqliteModule = typeof import('node:sqlite');

/** node:sqlite를 불러오며 ExperimentalWarning만 걸러 CLI stderr 오염을 막는다. */
export function loadSqlite(): SqliteModule {
  const original = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    const arg = rest[0] as string | { type?: string } | undefined;
    const type = typeof warning !== 'string' ? warning.name : typeof arg === 'string' ? arg : arg?.type;
    if (type === 'ExperimentalWarning') return;
    return (original as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return process.getBuiltinModule('node:sqlite');
  } finally {
    process.emitWarning = original;
  }
}

export interface OpenDatabaseOptions {
  /** 연결 직후(WAL 전환·마이그레이션 포함)부터 적용하는 busy_timeout. 기본 2000ms(Zen 락). */
  readonly busyTimeoutMs?: number;
  /** 적용할 마이그레이션. 기본은 migrate()의 기본값. */
  readonly migrations?: readonly Migration[];
}

const MIGRATION_ATTEMPTS = 6;
const MIGRATION_RETRY_BUDGET_MS = 900, BUSY_POLL_MS = 5;

/** SQLite primary/extended BUSY·LOCKED codes and Node's database-is-locked errors. */
export function isBusy(error: unknown): boolean {
  const detail = error as { errcode?: unknown; code?: unknown; errstr?: unknown; message?: unknown } | null;
  const code = detail?.errcode;
  if (typeof code === 'number' && Number.isSafeInteger(code) && [5, 6].includes(code & 0xff)) return true;
  if (typeof detail?.code === 'string' && /^SQLITE_(?:BUSY|LOCKED)(?:_|$)/.test(detail.code)) return true;
  const message = [detail?.message, detail?.errstr].filter((part): part is string => typeof part === 'string').join(' ');
  return /\bdatabase\b.*\blocked\b/i.test(message);
}

/** Keep busy_timeout; retry lock failures up to 6 attempts within the existing projected 900ms budget. */
export function withMigrationRetry<T>(run: () => T): T {
  const began = performance.now();
  for (let attempt = 1; ; attempt += 1) {
    const attemptBegan = performance.now();
    try { return run(); }
    catch (error) {
      const now = performance.now();
      const nextWait = Math.max(100, now - attemptBegan) + 10;
      if (!isBusy(error) || attempt >= MIGRATION_ATTEMPTS || now - began + nextWait >= MIGRATION_RETRY_BUDGET_MS) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
}

/** BUSY를 벽시계 기한(ms) 안에서만 재시도한다. SQLite 기본 busy handler는 명목 sleep 합으로 timeout을 세므로
 * sleep이 늘어지는 환경에서는 실제 대기가 timeout을 넘는다. 호출 동안만 busy_timeout을 0으로 두고 원래 값으로 되돌린다. */
export function withBusyDeadline<T>(db: DatabaseSync, deadlineMs: number, run: () => T): T {
  const began = performance.now(), prev = (db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout;
  db.exec('PRAGMA busy_timeout = 0');
  try {
    for (;;) {
      try { return run(); }
      catch (error) {
        if (!isBusy(error) || performance.now() - began + BUSY_POLL_MS > deadlineMs) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BUSY_POLL_MS);
      }
    }
  } finally { db.exec(`PRAGMA busy_timeout = ${prev}`); }
}

/** 파일을 0600으로 만들고 WAL·busy_timeout·마이그레이션을 적용해 연다. */
export function openDatabase(path: string, options: OpenDatabaseOptions = {}): DatabaseSync {
  const busyTimeoutMs = options.busyTimeoutMs ?? 2000;
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new RangeError('Invalid busy timeout');
  }
  ensureDataDir(dirname(path));
  if (!existsSync(path)) closeSync(openSync(path, 'a', 0o600));
  const db = new (loadSqlite().DatabaseSync)(path);
  try {
    db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
    withMigrationRetry(() => {
      const mode = (db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode;
      if (mode.toLowerCase() !== 'wal') db.exec('PRAGMA journal_mode = WAL');
      migrate(db, options.migrations);
    });
  } catch (error) {
    db.close();
    throw error;
  }
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(path + suffix)) chmodSync(path + suffix, 0o600);
  }
  return db;
}
