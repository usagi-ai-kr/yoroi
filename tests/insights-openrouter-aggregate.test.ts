import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOpenRouterTop50 } from '../src/insights/openrouter-top50.js';
import type { ParseRowResult } from '../src/insights/parse-utils.js';

const row = (index: number, date: string, value: number, modelId = `m${index}`, aggregate = false): ParseRowResult =>
  ({ ok: true, index, warnings: [], records: [{ source: 'openrouter', modelId, metric: 'total_tokens', value,
    unit: 'tokens', category: 'usage', observedAt: '2026-10-12T00:00:00Z', sourceAsOf: '2026-10-12T00:00:00Z',
    sourceUrl: 'https://openrouter.ai/rankings', sourceName: 'OpenRouter', license: 'CC-BY-4.0',
    attributionText: 'x', method: 'official-api', schemaVersion: 'v1', metadata: { date, aggregate } }] });

test('aggregate other row never consumes a model top50 slot and is preserved separately', () => {
  const models = Array.from({ length: 50 }, (_, i) => row(i, '2026-10-11', 1000 - i));
  const tie = row(50, '2026-10-11', 951);
  const below = row(51, '2026-10-11', 950);
  const other = row(99, '2026-10-11', 99999, 'other', true);
  const kept = filterOpenRouterTop50([...models, tie, below, other]).map(entry => entry.index);
  assert.equal(kept.length, 52, '50 models + tie at the cutoff + other');
  assert.ok(kept.includes(99), 'other must be kept separately');
  assert.ok(kept.includes(49) && kept.includes(50), 'cutoff model and tie are kept');
  assert.ok(!kept.includes(51), 'first model below the cutoff is dropped even though other is huge');
});
test('dates keep independent model slots and each date preserves its own other row', () => {
  const dayA = [row(0, '2026-10-10', 10), row(1, '2026-10-10', 9), row(2, '2026-10-10', 9999, 'other', true)];
  const dayB = [row(3, '2026-10-11', 5), row(4, '2026-10-11', 9999, 'other-a', true), row(5, '2026-10-11', 4)];
  const kept = filterOpenRouterTop50([...dayA, ...dayB], 2).map(entry => entry.index).sort((a, b) => a - b);
  assert.deepEqual(kept, [0, 1, 2, 3, 4, 5]);
});
