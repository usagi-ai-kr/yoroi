import { execFileSync } from 'node:child_process';

/** Read-only probe for the newest running OpenCode process start time.
 *
 * One `ps` call per cycle and nothing else: no command arguments, no environment, no session files, no
 * conversation content and no logs are read or recorded. `etime` (`[[dd-]hh:]mm:ss` elapsed time) is the one
 * keyword that is identical on macOS (BSD ps) and Linux (procps); `etimes` exists only on Linux and
 * locale-formatted `lstart` is avoided on purpose.
 *
 * The runner is injected so tests never shell out. It returns stdout and throws when the call fails; any
 * failure yields undefined, which simply omits the staleness verdict for that cycle. The result has second
 * precision at best (elapsed time is floored): callers must normalize it before using it as an identity. */
export type SyncProcessRun = (executable: string, args: readonly string[], timeoutMs: number) => string;

/** Default runner: fixed PATH, short timeout, no shell, and the child's stderr is discarded (a failing ps must
 * never write into the detector's own diagnostics). */
export const runPs: SyncProcessRun = (executable, args, timeoutMs) =>
  execFileSync(executable, [...args], { timeout: timeoutMs, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });

/** `[[dd-]hh:]mm:ss` to seconds, or undefined for anything else. */
export function parseEtime(text: string): number | undefined {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(text);
  if (!match) return undefined;
  const [days, hours, minutes, seconds] = [match[1], match[2], match[3], match[4]].map(part => (part === undefined ? 0 : Number(part)));
  if (seconds! >= 60 || (match[2] !== undefined && minutes! >= 60)) return undefined;
  const total = days! * 86_400 + hours! * 3_600 + minutes! * 60 + seconds!;
  return Number.isSafeInteger(total) ? total : undefined;
}

/** Matches an OpenCode process without matching a path that merely contains the word. */
function isOpencode(command: string): boolean {
  const name = command.trim().split('/').pop() ?? '';
  return /^opencode/i.test(name);
}

export function opencodeStartedAtMs(run: SyncProcessRun = runPs,
  nowMs: () => number = Date.now): () => number | undefined {
  return () => {
    let stdout: string;
    try { stdout = run('ps', ['-axo', 'etime=,comm='], 2000); } catch { return undefined; }
    if (typeof stdout !== 'string') return undefined;
    let newest: number | undefined;
    for (const line of stdout.split('\n')) {
      const match = /^\s*(\S+)\s+(.*\S)\s*$/.exec(line);
      const elapsed = match ? parseEtime(match[1]!) : undefined;
      if (elapsed === undefined || !isOpencode(match![2]!)) continue;
      if (newest === undefined || elapsed < newest) newest = elapsed; // newest start = smallest elapsed
    }
    if (newest === undefined) return undefined;
    const startedAtMs = nowMs() - newest * 1000;
    return Number.isSafeInteger(startedAtMs) ? startedAtMs : undefined;
  };
}

/** Probe used when process inspection is unavailable or explicitly not wanted. */
export const noOpencodeProcess: () => number | undefined = () => undefined;
