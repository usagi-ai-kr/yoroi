import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSnapshot } from '../src/insights/model-discovery-snapshot.js';
import type { ModelRegistrySnapshot } from '../src/insights/model-discovery-types.js';

const NOW = Date.parse('2026-10-20T00:00:00.000Z');
const AT = '2026-10-20T00:00:00.000Z';
const good = { modelId: 'm-1', displayName: 'M', sourceUrl: 'https://example.test/x',
  checkedOn: '2026-10-19', verified: true, planIds: ['p'], efforts: ['high'] };
const prev = (generation: number): ModelRegistrySnapshot =>
  ({ generation, observedAt: AT, providerId: 'a', models: [good] });

test('invalid previous generations do not inherit into usable snapshots', () => {
  for (const gen of [-1, NaN, 2.5, 0]) {
    const r = buildSnapshot(prev(gen), 'a', [good], AT, NOW);
    assert.equal(r.reason, 'usable');
    assert.equal(r.snapshot?.generation, 1, `prev gen ${String(gen)} must restart at 1`);
    assert.equal(r.snapshot?.providerId, 'a');
  }
});

test('valid previous generation still inherits', () => {
  const r = buildSnapshot(prev(3), 'a', [good], AT, NOW);
  assert.equal(r.snapshot?.generation, 4);
});
