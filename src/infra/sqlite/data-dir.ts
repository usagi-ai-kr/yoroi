import { chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const DB_FILE_NAME = 'yoroi.db';

/** YOROI_DATA_DIR → ${XDG_DATA_HOME}/yoroi → ~/.local/share/yoroi 순으로 해석한다. */
export function resolveDataDir(env: NodeJS.ProcessEnv): string {
  const explicit = env.YOROI_DATA_DIR?.trim();
  if (explicit) return explicit;
  const xdg = env.XDG_DATA_HOME?.trim();
  const base = xdg && isAbsolute(xdg) ? xdg : join(env.HOME?.trim() || homedir(), '.local', 'share');
  return join(base, 'yoroi');
}

export function resolveDbPath(env: NodeJS.ProcessEnv): string {
  return join(resolveDataDir(env), DB_FILE_NAME);
}

/** 데이터 디렉터리를 만들고 0700으로 맞춘다. */
export function ensureDataDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
}
