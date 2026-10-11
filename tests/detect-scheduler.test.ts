import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_DETECT_INTERVAL_MS, runFixedSchedule, type DetectSleep } from '../src/app/detect-scheduler.js';
import { SourceError } from '../src/app/usage-source.js';

interface Fake { now(): number; sleeps: number[]; sleep: DetectSleep; advance(ms: number): void }
function fake(start = 0): Fake {
  let time = start; const sleeps: number[] = [];
  return { now: () => time, sleeps, advance: (ms: number) => { time += ms; },
    sleep: async (ms: number, signal: AbortSignal) => {
      sleeps.push(ms); if (signal.aborted) throw new SourceError('cancelled'); time += ms;
    } };
}
/** N회 실행 후 중단하며 각 실행 시각을 기록한다. */
function collector(clock: Fake, stops: number, before?: () => void) {
  const at: number[] = []; const controller = new AbortController();
  const cycle = async () => {
    at.push(clock.now()); before?.(); if (at.length === stops) controller.abort();
  };
  return { at, controller, cycle };
}

test('runs once immediately and repeats on the fixed period with no drift', async () => {
  const clock = fake(); const run = collector(clock, 3);
  await runFixedSchedule(run.cycle, run.controller.signal, { sleep: clock.sleep, now: clock.now });
  assert.equal(DEFAULT_DETECT_INTERVAL_MS, 600_000);
  assert.deepEqual(run.at, [0, 600_000, 1_200_000]);
  assert.deepEqual(clock.sleeps, [600_000, 600_000]);
});

test('an overlong cycle skips missed ticks instead of bursting', async () => {
  const clock = fake();
  const run = collector(clock, 2, () => { if (run.at.length === 1) clock.advance(700_000); });
  await runFixedSchedule(run.cycle, run.controller.signal, { sleep: clock.sleep, now: clock.now });
  assert.deepEqual(run.at, [0, 1_200_000], 'second run must land on the next aligned 1200s slot');
  assert.deepEqual(clock.sleeps, [500_000], 'only the remaining wait is slept, no catch-up run');
});

test('a cycle failure is reported and the loop keeps running', async () => {
  const clock = fake(); const errors: unknown[] = [];
  const run = collector(clock, 3, () => { if (run.at.length === 2) throw new Error('synthetic cycle failure'); });
  await runFixedSchedule(run.cycle, run.controller.signal,
    { sleep: clock.sleep, now: clock.now, onCycleError: error => errors.push(error) });
  assert.equal(errors.length, 1);
  assert.equal((errors[0] as Error).message, 'synthetic cycle failure');
  assert.deepEqual(run.at, [0, 600_000, 1_200_000]);
});

test('abort during the wait ends the loop without another cycle', async () => {
  const controller = new AbortController(); let runs = 0;
  await runFixedSchedule(async () => { runs += 1; }, controller.signal, {
    now: () => 0, sleep: async () => { controller.abort(); throw new SourceError('cancelled'); },
  });
  assert.equal(runs, 1);
});

test('an already aborted signal never runs a cycle', async () => {
  const controller = new AbortController(); controller.abort(); let runs = 0;
  await runFixedSchedule(async () => { runs += 1; }, controller.signal,
    { now: () => 0, sleep: async () => { throw new SourceError('cancelled'); } });
  assert.equal(runs, 0);
});

test('a cancelled sleep stops quietly but a real sleep failure surfaces', async () => {
  const clock = fake();
  await assert.doesNotReject(runFixedSchedule(async () => {}, new AbortController().signal,
    { now: clock.now, sleep: async () => { throw new SourceError('cancelled'); } }));
  await assert.rejects(runFixedSchedule(async () => {}, new AbortController().signal,
    { now: clock.now, sleep: async () => { throw new Error('synthetic sleep failure'); } }),
  /synthetic sleep failure/);
});

test('a custom interval is honoured and out-of-range values are rejected', async () => {
  const clock = fake(); const run = collector(clock, 2);
  await runFixedSchedule(run.cycle, run.controller.signal, { sleep: clock.sleep, now: clock.now, intervalMs: 1_000 });
  assert.deepEqual(run.at, [0, 1_000]);
  for (const intervalMs of [0, 999, 86_400_001, 1.5]) {
    await assert.rejects(runFixedSchedule(async () => {}, new AbortController().signal,
      { now: () => 0, sleep: async () => {}, intervalMs }), RangeError);
  }
});

test('the scheduler stays a pure app module', () => {
  const source = readFileSync(new URL('../src/app/detect-scheduler.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from\s+['"][^'"]*(infra|node:)/,
    'the fixed scheduler must not import infra or node built-ins');
});
