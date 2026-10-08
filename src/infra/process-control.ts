import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export function terminateProcess(child: ChildProcessWithoutNullStreams,
  signal: NodeJS.Signals): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try { process.kill(-child.pid, signal); return; }
    catch { /* A completed group or a custom runner can fall back to the child. */ }
  }
  try { child.kill(signal); } catch { /* Cleanup must preserve the original query error. */ }
}
