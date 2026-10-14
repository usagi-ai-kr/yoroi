import assert from 'node:assert/strict';
import test from 'node:test';
import { unmeasuredFreeIds } from '../src/insights/letter-markdown-free.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const model = (modelId: string) => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true, free: true });
const zen: PlanCatalogEntry = { planId: 'zen-free', planName: 'OpenCode Zen Free', tier: 'free',
  models: [model('nemotron-3-ultra'), model('space-bunny')] };

test('alias-measured free models are not also listed as AA-unmeasured (same resolution as the ranked tables)', () => {
  const records = [{ modelId: 'nvidia-nemotron-3-ultra-550b-a55b', value: 49.3, metric: 'artificial_analysis_coding_index' }];
  assert.deepEqual(unmeasuredFreeIds([zen], records), ['space-bunny']);
  assert.deepEqual(unmeasuredFreeIds([zen], []), ['nemotron-3-ultra', 'space-bunny']);
});
