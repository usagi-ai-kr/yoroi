// yoroi-managed: opencode-zen-free v1
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export async function loadFreeModels() {
  try {
    const cache = process.env.XDG_CACHE_HOME || path.join(homedir(), '.cache');
    const file = path.join(cache, 'opencode', 'models.json');
    if ((await stat(file)).size > 16 * 1024 * 1024) return new Set();
    const models = JSON.parse(await readFile(file, 'utf8'))?.opencode?.models;
    return new Set(Object.entries(models ?? {}).filter(([, m]) =>
      m?.cost?.input === 0 && m?.cost?.output === 0).map(([id]) => id));
  } catch { return new Set(); }
}

export function report(args) {
  return new Promise(resolve => {
    try {
      execFile(process.env.YOROI_BIN || 'yoroi', ['zen-free', 'report', ...args],
        { timeout: 6000, killSignal: 'SIGKILL', maxBuffer: 4096, windowsHide: true }, error => resolve(!error));
    } catch { resolve(false); }
  });
}
