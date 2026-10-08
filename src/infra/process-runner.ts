import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { SourceError } from '../app/usage-source.js';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from './process-port.js';
import { terminateProcess } from './process-control.js';

type Spawn = (executable: string, args: readonly string[],
  env: Readonly<Record<string, string | undefined>>) => ChildProcessWithoutNullStreams;
export class NodeProcessRunner implements ProcessRunner {
  constructor(private readonly start: Spawn = (exe, args, env) =>
    spawn(exe, args, { env, shell: false, stdio: 'pipe', detached: process.platform !== 'win32' }),
    private readonly terminationGraceMs = 250) {}
  run(request: ProcessRequest, signal?: AbortSignal): Promise<ProcessOutput> {
    if (signal?.aborted) return Promise.reject(new SourceError('cancelled'));
    if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs <= 0 || request.timeoutMs > 86400000) {
      return Promise.reject(new SourceError('unavailable'));
    }
    return new Promise((resolve, reject) => {
      let child: ChildProcessWithoutNullStreams;
      try { child = this.start(request.executable, request.args, { ...process.env, ...request.env }); }
      catch { reject(new SourceError('unavailable')); return; }
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      let stdout = '', stderr = '', pending = '', step = 0;
      let stdoutBytes = 0, stderrBytes = 0;
      let failure: SourceError | undefined;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const finish = (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(killTimer);
        signal?.removeEventListener('abort', abort);
        if (failure) { terminateProcess(child, 'SIGKILL'); reject(failure); }
        else resolve({ stdout, stderr, exitCode: code ?? 1 });
      };
      const stop = (error: SourceError) => {
        if (settled || failure) return;
        failure = error;
        terminateProcess(child, 'SIGTERM');
        if (!settled) killTimer = setTimeout(() => {
          terminateProcess(child, 'SIGKILL');
          child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
          finish(null);
        }, this.terminationGraceMs);
      };
      const abort = () => stop(new SourceError('cancelled'));
      const timer = setTimeout(() => stop(new SourceError('timeout')), request.timeoutMs);
      signal?.addEventListener('abort', abort, { once: true });
      child.on('error', (error: NodeJS.ErrnoException) => {
        if (failure) return;
        failure = new SourceError(error.code === 'ENOENT' ? 'not-installed' : 'unavailable');
        finish(null);
      });
      child.on('close', finish);
      child.stdin.on('error', () => stop(new SourceError('unavailable')));
      const send = () => {
        const next = request.steps?.[step];
        if (next) child.stdin.write(next.input);
        else child.stdin.end();
      };
      child.stdout.on('data', (chunk: string) => {
        if (failure || settled) return;
        stdoutBytes += Buffer.byteLength(chunk);
        if (stdoutBytes > 1048576) { stop(new SourceError('parse')); return; }
        stdout += chunk;
        if (!request.steps) return;
        pending += chunk;
        let newline: number;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          try {
            const message: unknown = JSON.parse(line);
            if (message && typeof message === 'object' && 'id' in message &&
              message.id === request.steps[step]?.responseId) {
              step++;
              send();
            }
          } catch { /* Non-protocol output is validated by the adapter. */ }
        }
      });
      child.stderr.on('data', (chunk: string) => {
        if (failure || settled) return;
        stderrBytes += Buffer.byteLength(chunk);
        if (stderrBytes > 1048576) { stop(new SourceError('parse')); return; }
        stderr += chunk;
      });
      if (request.steps?.length) send();
      else child.stdin.end(request.input);
      if (signal?.aborted) abort();
    });
  }
}
