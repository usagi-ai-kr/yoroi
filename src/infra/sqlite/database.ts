import { chmodSync, closeSync, existsSync, openSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { dirname } from 'node:path';
import { ensureDataDir } from './data-dir.js';
import { migrate } from './migrations.js';

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

/** 파일을 0600으로 만들고 WAL·busy_timeout·마이그레이션을 적용해 연다. */
export function openDatabase(path: string): DatabaseSync {
  ensureDataDir(dirname(path));
  if (!existsSync(path)) closeSync(openSync(path, 'a', 0o600));
  const db = new (loadSqlite().DatabaseSync)(path);
  try {
    db.exec('PRAGMA busy_timeout = 2000');
    db.exec('PRAGMA journal_mode = WAL');
    migrate(db);
  } catch (error) {
    db.close();
    throw error;
  }
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(path + suffix)) chmodSync(path + suffix, 0o600);
  }
  return db;
}
