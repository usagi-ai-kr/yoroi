import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { NodeProcessRunner } from '../src/infra/process-runner.js';

function fake() {
  const child = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    kill: (_signal?: string) => { queueMicrotask(() => child.emit('close', null)); return true; },
  });
  return child;
}
const request = { executable: 'test-cli', args: ['arg with space'], timeoutMs: 100 };
test('process runner preserves args and output; nonzero exit is returned to adapter', async () => {
  const child = fake();
  const runner = new NodeProcessRunner((exe, args) => {
    assert.equal(exe, 'test-cli'); assert.deepEqual(args, ['arg with space']);
    queueMicrotask(() => {
      child.stdout.write('out'); child.stderr.write('secret'); child.emit('close', 2);
    });
    return child as unknown as ChildProcessWithoutNullStreams;
  });
  assert.deepEqual(await runner.run(request), { stdout: 'out', stderr: 'secret', exitCode: 2 });
});
test('runner reports missing executable, timeout and cancellation without raw data', async () => {
  const missing = fake();
  const runner = new NodeProcessRunner(() => {
    queueMicrotask(() => missing.emit('error', Object.assign(new Error('secret'), { code: 'ENOENT' })));
    return missing as unknown as ChildProcessWithoutNullStreams;
  });
  await assert.rejects(runner.run(request), { code: 'not-installed' });
  const waiting = new NodeProcessRunner(() => fake() as unknown as ChildProcessWithoutNullStreams);
  await assert.rejects(waiting.run({ ...request, timeoutMs: 5 }), { code: 'timeout' });
  const controller = new AbortController();
  const pending = waiting.run(request, controller.signal);
  controller.abort();
  await assert.rejects(pending, { code: 'cancelled' });
});
test('JSONL conversation waits for each response ID before sending next input', async () => {
  const child = fake();
  const inputs: string[] = [];
  child.stdin.on('data', chunk => {
    inputs.push(String(chunk));
    const id = inputs.length;
    queueMicrotask(() => child.stdout.write(JSON.stringify({ id, result: {} }) + '\n'));
  });
  child.stdin.on('finish', () => child.emit('close', 0));
  const runner = new NodeProcessRunner(() => child as unknown as ChildProcessWithoutNullStreams);
  const output = await runner.run({ ...request, steps: [
    { input: 'init\n', responseId: 1 }, { input: 'read\n', responseId: 2 },
  ] });
  assert.deepEqual(inputs, ['init\n', 'read\n']);
  assert.ok(output.stdout.includes('"id":2'));
});
test('process cancellation cause survives child errors during termination', async () => {
  const child = fake();
  child.kill = () => {
    queueMicrotask(() => {
      child.emit('error', Object.assign(new Error('secret'), { code: 'EPIPE' }));
      child.emit('close', null);
    });
    return true;
  };
  const runner = new NodeProcessRunner(() => child as unknown as ChildProcessWithoutNullStreams);
  await assert.rejects(runner.run({ ...request, timeoutMs: 5 }), { code: 'timeout' });
});
test('process runner preserves UTF-8 text split between output chunks', async () => {
  const child = fake();
  const runner = new NodeProcessRunner(() => {
    queueMicrotask(() => {
      const text = Buffer.from('한글');
      child.stdout.write(text.subarray(0, 1));
      child.stdout.write(text.subarray(1));
      child.emit('close', 0);
    });
    return child as unknown as ChildProcessWithoutNullStreams;
  });
  assert.equal((await runner.run(request)).stdout, '한글');
});
