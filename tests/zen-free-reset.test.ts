import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryZenLockStore } from '../src/app/zen-lock-memory.js';
import { createCli } from '../src/ui/cli/bootstrap.js';
import { zenFreeJsonStatus, zenFreeRow } from '../src/ui/cli/zen-free.js';
import { renderPretty } from '../src/ui/cli/render.js';

function setup() {
  const stdout: string[] = [], stderr: string[] = [];
  const cli = createCli({
    env: { stdout: line => stdout.push(line), stderr: line => stderr.push(line) },
    sources: [], zenLockStore: new MemoryZenLockStore(), subscribeSignals: () => () => {},
  });
  return { cli, stdout, stderr };
}

test('zenFreeJsonStatus calculates positive retryInSeconds for future retry', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const future = new Date('2026-10-10T00:30:15.000Z');
  const state = { scope: 'opencode-zen:free', state: 'locked' as const,
    retryAt: future.toISOString(), updatedAt: now.toISOString() };
  const json = zenFreeJsonStatus(state, now);
  assert.equal(json.state, 'locked');
  assert.equal(json.retryPassed, false);
  assert.equal(json.retryInSeconds, 1815);
});

test('zenFreeJsonStatus returns null retryInSeconds when retryAt is past or exact now', () => {
  const state = { scope: 'opencode-zen:free', state: 'locked' as const,
    retryAt: '2026-10-10T01:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' };
  const exact = zenFreeJsonStatus(state, new Date('2026-10-10T01:00:00.000Z'));
  assert.equal(exact.retryInSeconds, null);
  assert.equal(exact.retryPassed, false);
  const past = zenFreeJsonStatus(state, new Date('2026-10-10T01:00:01.000Z'));
  assert.equal(past.retryInSeconds, null);
  assert.equal(past.retryPassed, true);
});

test('zenFreeJsonStatus returns null retryInSeconds for clear or unknown state', () => {
  assert.equal(zenFreeJsonStatus(null).retryInSeconds, null);
  const clearState = { scope: 'opencode-zen:free', state: 'clear' as const, updatedAt: '2026-10-10T00:00:00Z' };
  assert.equal(zenFreeJsonStatus(clearState).retryInSeconds, null);
});

test('cli status --json outputs positive retryInSeconds when locked with retry-in', async () => {
  const { cli, stdout } = setup();
  assert.equal(await cli.run(['zen-free', 'report', '--exceeded', '--retry-in', '1800']), 0);
  assert.equal(await cli.run(['zen-free', 'status', '--json']), 0);
  const data = JSON.parse(stdout.at(-1)!);
  assert.equal(data.state, 'locked');
  assert.equal(data.retryPassed, false);
  assert.ok(typeof data.retryInSeconds === 'number');
  assert.ok(data.retryInSeconds > 0 && data.retryInSeconds <= 1800);
});

test('zenFreeJsonStatus and zenFreeRow calculate elapsed locked time', () => {
  const lockStart = new Date('2026-10-10T00:00:00.000Z');
  const now = new Date('2026-10-10T01:35:20.000Z');
  const state = { scope: 'opencode-zen:free', state: 'locked' as const,
    lockedAt: lockStart.toISOString(), updatedAt: lockStart.toISOString() };
  assert.equal(zenFreeJsonStatus(state, now).lockedForSeconds, 5720);
  assert.match(zenFreeRow(state, now).detail, /locked_for=1h35m/);
  const fallback = { scope: 'opencode-zen:free', state: 'locked' as const, updatedAt: lockStart.toISOString() };
  assert.equal(zenFreeJsonStatus(fallback, now).lockedForSeconds, 5720);
  assert.match(zenFreeRow(fallback, now).detail, /locked_for=1h35m/);
  assert.equal(zenFreeJsonStatus(null, now).lockedForSeconds, null);
  assert.doesNotMatch(zenFreeRow(state, lockStart).detail, /retry_in=/);
});

test('zenFreeRow returns resetAt, resetPassed, and timeLeft when locked with retryAt', () => {
  const now = new Date('2026-10-10T00:00:00.000Z');
  const future = new Date('2026-10-10T03:05:00.000Z').toISOString();
  const r1 = zenFreeRow({ scope: 'z', state: 'locked', retryAt: future, updatedAt: now.toISOString() }, now);
  assert.equal(r1.resetAt, future);
  assert.equal(r1.resetPassed, false);
  assert.equal(r1.timeLeft, '3h 5m');

  const past = new Date('2026-10-09T23:59:00.000Z').toISOString();
  const r2 = zenFreeRow({ scope: 'z', state: 'locked', retryAt: past, updatedAt: now.toISOString() }, now);
  assert.equal(r2.resetAt, past);
  assert.equal(r2.resetPassed, true);
  assert.equal(r2.timeLeft, undefined);

  assert.equal(zenFreeRow({ scope: 'z', state: 'locked', updatedAt: now.toISOString() }, now).resetAt, undefined);
  assert.equal(zenFreeRow({ scope: 'z', state: 'clear', updatedAt: now.toISOString() }, now).resetAt, undefined);
});

test('renderPretty shows estimated Reset (~KST) for zen-free, (passed) when past, - when missing', () => {
  const now = '2026-10-10T00:00:00.000Z';
  const fText = renderPretty([], { scope: 'z', state: 'locked', retryAt: '2026-10-10T03:05:00.000Z', updatedAt: now }).join('\n');
  assert.match(fText, /opencode-zen-free.*~2026-10-10 12:05/);

  const pText = renderPretty([], { scope: 'z', state: 'locked', retryAt: '2026-10-09T23:59:00.000Z', updatedAt: now }).join('\n');
  assert.match(pText, /~2026-10-10 08:59[\s\S]*\(passed\)/);

  const noReset = renderPretty([], { scope: 'z', state: 'clear', updatedAt: now }, { full: true }).join('\n');
  assert.match(noReset, /opencode-zen-free\s*│\s*clear\s*│\s*-\s*│\s*-\s*│\s*-/);
});
