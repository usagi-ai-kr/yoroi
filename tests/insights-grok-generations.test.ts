import assert from 'node:assert/strict';
import test from 'node:test';
import { dropOlderVersions, separateGptSolModels } from '../src/insights/letter-top10-filter.js';
import { calcCostEfficiency, type ModelVariant } from '../src/insights/letter-top10-group.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { normalizeModelName } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const variant = (modelId: string, value = 90): ModelVariant => {
  const cost = 1, eff = calcCostEfficiency(value, cost);
  return { modelId, baseModelId: modelId, effort: 'default', value,
    ...(eff !== undefined && { blendedCost: cost, costEfficiency: eff }) };
};
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 't', planName: 'T',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-15', verified: true })) }];

test('Grok 4.6 and 4.7 stay together; 4.5 drops; Sol pair stays independent', () => {
  assert.equal(separateGptSolModels('grok-4-6', 'grok-4-7'), true);
  assert.equal(separateGptSolModels('grok-4-7', 'grok-4-5'), false);
  assert.equal(separateGptSolModels('gpt-6-sol', 'gpt-6-1-sol'), true);
  const kept = dropOlderVersions(['grok-4-7', 'grok-4-6', 'grok-4-5', 'gpt-6-1-sol', 'gpt-6-sol'].map(id => variant(id)));
  assert.deepEqual(kept.map(v => v.modelId).sort(), ['gpt-6-1-sol', 'gpt-6-sol', 'grok-4-6', 'grok-4-7']);
});

test('effort suffix and snapshot/dot ids still keep 4.6 with 4.7 and drop 4.5', () => {
  assert.equal(normalizeModelName('grok-4.6'), 'grok-4-6');
  assert.equal(normalizeModelName('grok-4-6-2026-10-15'), 'grok-4-6');
  const snap = dropOlderVersions(['grok-4-7', 'grok-4-6-2026-10-15', 'grok-4.5'].map(id => variant(id)));
  assert.deepEqual(snap.map(v => v.modelId).sort(), ['grok-4-6-2026-10-15', 'grok-4-7']);
  const ids = ['grok-4-7', 'grok-4-6', 'grok-4-5'];
  const records = [
    { modelId: 'grok-4-7-high', metric: 'artificial_analysis_intelligence_index', value: 90, successorOf: 'grok-4-6' },
    { modelId: 'grok-4-6-xhigh', metric: 'artificial_analysis_intelligence_index', value: 80 },
    { modelId: 'grok-4-5', metric: 'artificial_analysis_intelligence_index', value: 70 }];
  const pool = buildCandidatePool(records, catalogFor(ids));
  assert.deepEqual(pool.accessibleRecords.map(r => r.modelId).sort(), ['grok-4-6-xhigh', 'grok-4-7-high']);
  const entries = computeRoleTop10(records, { catalog: catalogFor(ids) }).orchestrator.entries;
  assert.deepEqual(entries.map(e => [e.modelId, e.successorOf]).sort(), [['grok-4-6', undefined], ['grok-4-7', undefined]]);
});
