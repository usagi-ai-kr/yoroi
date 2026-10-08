import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { NodeProcessRunner } from '../src/infra/process-runner.js';

test('termination settles after grace period even when descendant pipes prevent close', async () => {
  const signals: string[] = [];
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: (signal: string) => { signals.push(signal); return true; },
  });
  const runner = new NodeProcessRunner(() => child as unknown as ChildProcessWithoutNullStreams, 5);
  await assert.rejects(runner.run({ executable: 'fake', args: [], timeoutMs: 5 }), { code: 'timeout' });
  assert.ok(signals.includes('SIGTERM'));
  assert.ok(signals.includes('SIGKILL'));
  assert.ok(child.stdout.destroyed);
  assert.ok(child.stderr.destroyed);
});
test('output size limit stops accumulation and rejects without raw output', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: () => { queueMicrotask(() => child.emit('close', null)); return true; },
  });
  const runner = new NodeProcessRunner(() => {
    queueMicrotask(() => child.stdout.write('x'.repeat(1048577)));
    return child as unknown as ChildProcessWithoutNullStreams;
  });
  await assert.rejects(runner.run({ executable: 'fake', args: [], timeoutMs: 100 }), { code: 'parse' });
});
