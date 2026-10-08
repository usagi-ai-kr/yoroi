import assert from 'node:assert/strict';
import test from 'node:test';
import { collectOnce } from '../src/app/collect-once.js';
import { watchUsage } from '../src/app/watch-usage.js';
import { SourceError, type UsageSource } from '../src/app/usage-source.js';
import { createSnapshot } from '../src/domain/usage.js';

const good: UsageSource = { provider: 'codex', read: async () =>
  createSnapshot('codex', '2026-10-07T00:00:00Z', []) };
const bad: UsageSource = { provider: 'agy', read: async () => { throw new SourceError('timeout'); } };
test('collection preserves stable order and isolates partial and total failure', async () => {
  const results = await collectOnce([bad, good]);
  assert.deepEqual(results.map(r => r.provider), ['agy', 'codex']);
  assert.ok('error' in results[0]!);
  assert.ok('snapshot' in results[1]!);
  const failure = await collectOnce([bad]);
  assert.equal('error' in failure[0]! && failure[0].error.code, 'timeout');
  const unexpected = await collectOnce([{ provider: 'claude', read: () => {
    throw new Error('secret-token');
  } }]);
  assert.equal('error' in unexpected[0]! && unexpected[0].error.message,
    'Usage query is unavailable');
});
test('collection rejects a mismatched provider returned by a source', async () => {
  const results = await collectOnce([{ ...good, provider: 'claude' }]);
  assert.equal('error' in results[0]! && results[0].error.code, 'parse');
});
test('watch immediately collects then sleeps 60 seconds; failures do not stop next cycles', async () => {
  const controller = new AbortController();
  const intervals: number[] = [];
  const scheduler = { sleep: async (ms: number) => { intervals.push(ms); } };
  let cycles = 0;
  for await (const result of watchUsage([bad, good], scheduler, controller.signal)) {
    assert.equal(intervals.length, cycles++);
    assert.equal(result.length, 2);
    if (cycles === 3) controller.abort();
  }
  assert.equal(cycles, 3);
  assert.deepEqual(intervals, [60000, 60000]);
});
test('watch does not schedule a cycle after cancellation and rejects invalid intervals', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  const scheduler = { sleep: async () => { called = true; } };
  for await (const _ of watchUsage([good], scheduler, controller.signal)) assert.fail('cycle');
  assert.equal(called, false);
  await assert.rejects(async () => {
    for await (const _ of watchUsage([good], scheduler, controller.signal, 0)) { /* empty */ }
  });
  await assert.rejects(async () => {
    for await (const _ of watchUsage([good], scheduler, controller.signal, 2147483648)) { /* empty */ }
  });
});
