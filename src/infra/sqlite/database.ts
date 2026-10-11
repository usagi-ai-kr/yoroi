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

const MIGRATION_ATTEMPTS = 3;

/** SQLITE_BUSY(5)·SQLITE_LOCKED(6). 다른 연결이 쓰기 잠금을 쥔 상태다. */
export function isBusy(error: unknown): boolean {
  const code = (error as { errcode?: unknown } | null)?.errcode;
  return code === 5 || code === 6;
}

/** 원래 busy_timeout 유지. SQLITE_BUSY만 총 3회, 다음 대기 추정치를 포함해 900ms 미만일 때 재시도한다. */
export function withMigrationRetry<T>(run: () => T): T {
  const began = performance.now();
  for (let attempt = 1; ; attempt += 1) {
    const attemptBegan = performance.now();
    try { return run(); }
    catch (error) {
      const now = performance.now();
      const nextWait = Math.max(100, now - attemptBegan) + 10;
      if ((error as { errcode?: unknown } | null)?.errcode !== 5 || attempt >= MIGRATION_ATTEMPTS ||
        now - began + nextWait >= 900) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
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
      db.exec('PRAGMA journal_mode = WAL');
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
