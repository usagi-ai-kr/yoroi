import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { AgySource } from '../src/infra/agy-source.js';
import type { ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';

const observedAt = '2026-10-07T00:00:00Z';
const readFix = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const fixture = await readFix('agy-usage.txt');
const exhaustedFixture = await readFix('agy-exhausted.txt');
const unauthFixture = await readFix('agy-unauthenticated.txt');
const notFoundFixture = await readFix('agy-not-installed.txt');

function runner(stdout: string, exitCode = 0, stderr = ''): ProcessRunner {
  return { run: async (_request: ProcessRequest) => ({ stdout, stderr, exitCode }) };
}

test('AGY source runs agy -p /usage and maps TSV windows', async () => {
  const fake: ProcessRunner = { run: async request => {
    assert.equal(request.executable, 'agy');
    assert.deepEqual(request.args, ['-p', '/usage']);
    return { stdout: fixture, stderr: '', exitCode: 0 };
  } };
  const snapshot = await new AgySource(fake, 'agy', 5000, () => observedAt).read();
  assert.equal(snapshot.provider, 'agy');
  assert.equal(snapshot.windows.length, 4);
  assert.equal(snapshot.windows[0]?.id, 'gemini-models:weekly-limit-remaining');
  assert.equal(snapshot.windows[0]?.percent, 20);
  assert.equal(snapshot.windows[0]?.remaining, 80);
  assert.equal(snapshot.windows[0]?.resetAt, '2026-10-14T04:00:00Z');
});

test('AGY source parses exhausted quota fixture', async () => {
  const snapshot = await new AgySource(runner(exhaustedFixture), 'agy', 5000, () => observedAt).read();
  assert.equal(snapshot.windows.length, 4);
  assert.ok(snapshot.windows.every(w => w.remaining === 0 && w.percent === 100));
});

test('AGY source normalizes exit code and authentication errors', async () => {
  await assert.rejects(new AgySource(runner('', 1)).read(), { code: 'exit' });
  await assert.rejects(new AgySource(runner('Account ineligible: not logged in')).read(), {
    code: 'authentication',
  });
  await assert.rejects(new AgySource(runner('', 1, 'Error: unauthenticated access')).read(), {
    code: 'authentication',
  });
  await assert.rejects(new AgySource(runner(unauthFixture)).read(), {
    code: 'authentication',
  });
  await assert.rejects(new AgySource(runner(notFoundFixture, 127)).read(), {
    code: 'exit',
  });
  await assert.rejects(new AgySource(runner(notFoundFixture, 0)).read(), {
    code: 'parse',
  });
  await assert.rejects(new AgySource(runner('invalid non-tsv format')).read(), {
    code: 'parse',
  });
});
