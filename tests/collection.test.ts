import assert from 'node:assert/strict';
import test from 'node:test';
import { collectOnce } from '../src/app/collect-once.js';
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
