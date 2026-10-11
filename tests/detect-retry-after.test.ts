import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { runDetectCycle, type DetectCycleDeps } from '../src/composition/detect.js';
import { loadConfig } from '../src/config/load-config.js';
import { createSnapshot } from '../src/domain/usage.js';
import { markRateLimited, rateLimitDelayMs, retryAfterSeconds } from '../src/domain/errors.js';
import { SourceError } from '../src/app/usage-source.js';

const T0 = Date.parse('2026-10-11T00:00:00Z'), MIN = 60_000;

test('the rate-limit marker carries only a delay and survives a real SourceError', () => {
  const marked = markRateLimited(new SourceError('unavailable'), 3_600_000);
  assert.equal(rateLimitDelayMs(marked), 3_600_000);
  assert.equal(marked.code, 'unavailable', 'the normalized code is untouched');
  assert.ok(!JSON.stringify(marked).includes('retryAfterMs'), 'the marker is not enumerable or serialized');
  assert.equal(retryAfterSeconds(3_600_000), '3600');
  assert.equal(retryAfterSeconds(500), '1', 'sub-second values round up, never 0');
  assert.equal(retryAfterSeconds(0), '1');
  assert.equal(retryAfterSeconds(undefined), undefined);
  assert.equal(rateLimitDelayMs(new SourceError('unavailable')), undefined);
  assert.equal(rateLimitDelayMs(undefined), undefined);
  assert.throws(() => markRateLimited(new Error('x'), -1), RangeError);
  assert.throws(() => markRateLimited(new Error('x'), 1.5), RangeError);
});

function harness(t: TestContext, provider: string, over: Partial<DetectCycleDeps> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-ratelimit-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dataEnv = { YOROI_DATA_DIR: dir }, env = { ...dataEnv, YOROI_PROVIDERS: provider, HOME: dir };
  const sim = { now: T0, reads: 0, rateLimitMs: undefined as number | undefined };
  const factories = { [provider]: () => ({ provider: provider as 'codex',
    read: async () => { sim.reads++;
      if (sim.rateLimitMs !== undefined) throw markRateLimited(new SourceError('unavailable'), sim.rateLimitMs);
      return createSnapshot(provider as 'codex', new Date(sim.now).toISOString(),
        [{ id: 'weekly', unit: 'percent', percent: 40, resetAt: '2026-10-18T00:00:00Z' }]); } }) };
  const deps = (): DetectCycleDeps => ({ config: loadConfig(env), env, dataEnv,
    now: () => sim.now, owner: 'detector-a', intervalMs: 5 * MIN, platform: 'linux', factories,
    thresholds: { surgePercentPoints: 20, staleAfterMs: 45 * MIN, pluginStaleGraceMs: 10 * MIN }, ...over });
  const at = async (minutes: number) => { sim.now = T0 + minutes * MIN; return runDetectCycle(deps()); };
  return { sim, at, dir, env, dataEnv };
}

test('D1: a 15-minute provider honours Retry-After 3600 instead of retrying at 15 minutes', async t => {
  const h = harness(t, 'opencode-go');
  h.sim.rateLimitMs = 3_600_000;
  await h.at(0);
  assert.equal(h.sim.reads, 1, 'the rate-limited attempt happened once');
  h.sim.rateLimitMs = undefined;
  for (const minutes of [5, 10, 14, 15, 29]) {
    await h.at(minutes);
    assert.equal(h.sim.reads, 1, `no retry at +${minutes}m; the server asked for 60 minutes`); }
  await h.at(60);
  assert.equal(h.sim.reads, 2, 'the retry happens once the server delay has passed'); });

test('D1: without any server delay the 15-minute interval alone governs the call', async t => {
  const h = harness(t, 'opencode-go');
  await h.at(0);
  assert.equal(h.sim.reads, 1);
  for (const minutes of [5, 10, 14]) { await h.at(minutes);
    assert.equal(h.sim.reads, 1, `no call before the interval elapses (+${minutes}m)`); }
  await h.at(15);
  assert.equal(h.sim.reads, 2, 'the interval alone released the next call'); });

test('D1: an unmarked rate limit falls back to the exponential cooldown, not to a bypass', async t => {
  const h = harness(t, 'opencode-go');
  const plain = { ...h.sim };
  void plain;
  await h.at(0);              // success establishes lastAttemptAtMs
  h.sim.rateLimitMs = 3_600_000;
  await h.at(15);             // call allowed at +15m, server says 60m
  assert.equal(h.sim.reads, 2);
  h.sim.rateLimitMs = undefined;
  for (const minutes of [20, 30, 45, 59]) { await h.at(minutes);
    assert.equal(h.sim.reads, 2, `still cooling down at +${minutes}m`); }
  await h.at(75);
  assert.equal(h.sim.reads, 3); });
