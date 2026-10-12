import assert from 'node:assert/strict';
import test from 'node:test';
import { toRankedRecords, type Top10RecordInput } from '../src/insights/letter-top10-rank.js';

test('mixed OpenRouter ranks are rebuilt from usage so official and inferred ranks cannot collide', () => {
  const rows: Top10RecordInput[] = [
    { modelId: 'high-usage', value: 200, rank: 2, metric: 'total_tokens' },
    { modelId: 'low-usage', value: 100, metric: 'total_tokens' },
  ];
  assert.deepEqual(toRankedRecords(rows).map(row => row.rank), [1, 2]);
});
