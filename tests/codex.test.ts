import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CodexSource } from '../src/infra/codex-source.js';
import type { ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';

const observedAt = '2026-10-07T00:00:00Z';
const fixture = JSON.stringify(JSON.parse(await readFile(
  new URL('./fixtures/codex-rate-limits.json', import.meta.url), 'utf8')));
function runner(stdout: string, exitCode = 0): ProcessRunner {
  return { run: async (_request: ProcessRequest) => ({ stdout, stderr: 'secret', exitCode }) };
}
test('Codex maps all buckets, percent and Unix reset without model calls', async () => {
  const fake: ProcessRunner = { run: async request => {
    assert.deepEqual(request.args, ['app-server', '--stdio']);
    assert.equal(request.steps?.length, 2);
    assert.ok(request.steps?.[1]?.input.includes('account/rateLimits/read'));
    assert.ok(!JSON.stringify(request).includes('turn/start'));
    return { stdout: '{"id":1,"result":{}}\n' + fixture + '\n', stderr: '', exitCode: 0 };
  } };
  const snapshot = await new CodexSource(fake, 'codex', 1000, () => observedAt).read();
  assert.equal(snapshot.windows.length, 2);
  assert.equal(snapshot.windows[0]?.percent, 40);
  assert.equal(snapshot.windows[1]?.percent, 100);
  assert.equal(snapshot.windows[1]?.resetAt, undefined);
  assert.equal(snapshot.windows[0]?.used, undefined);
});
test('Codex distinguishes errors and rejects unsupported output without raw secrets', async () => {
  const cases: [string, number, string][] = [
    ['{ "id":2,"error":{"code":401,"message":"secret"}}\n', 0, 'authentication'],
    ['secret', 0, 'parse'], ['{ "id":2,"result":{}}\n', 0, 'parse'],
    ['', 3, 'exit'],
  ];
  for (const [text, status, code] of cases) {
    await assert.rejects(new CodexSource(runner(text, status), 'codex', 1000).read(),
      (error: unknown) => error instanceof Error && 'code' in error && error.code === code &&
        !error.message.includes('secret'));
  }
});
test('Codex accepts legacy bucket and null windows, rejects invalid metrics', async () => {
  const source = (result: unknown) => new CodexSource(runner(JSON.stringify({ id: 2, result })), 'codex', 1000);
  const snapshot = await source({ rateLimits: { primary: null, secondary: null } }).read();
  assert.deepEqual(snapshot.windows, []);
  await assert.rejects(source({ rateLimits: { primary: { usedPercent: 101 } } }).read(), { code: 'parse' });
});
