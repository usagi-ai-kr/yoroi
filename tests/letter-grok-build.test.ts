import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidatePool, plansForCatalogModel } from '../src/insights/letter-top10-candidates.js';
import { plansForModel } from '../src/insights/letter-top10-plans.js';
import { computeRoleTop10, SECTION_HEADINGS } from '../src/insights/letter-top10-unified.js';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { SUPERGROK_PLAN } from '../src/insights/plan-catalog-xai.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const sampleRecords: readonly Top10RecordInput[] = [
  { modelId: 'grok-build-0-1-06-16', modelAlias: 'Grok Build 0.1 0616', metric: 'artificial_analysis_intelligence_index', value: 27.2 },
  { modelId: 'grok-build-0-1-06-16', modelAlias: 'Grok Build 0.1 0616', metric: 'artificial_analysis_coding_index', value: 51.5 },
  { modelId: 'grok-build-0-1-06-16', modelAlias: 'Grok Build 0.1 0616', metric: 'price_1m_input_tokens', value: 1 },
  { modelId: 'grok-build-0-1-06-16', modelAlias: 'Grok Build 0.1 0616', metric: 'price_1m_output_tokens', value: 2 },
  { modelId: 'claude-opus-5-5', value: 95, metric: 'artificial_analysis_intelligence_index' },
  { modelId: 'claude-sonnet-5-5', value: 90, metric: 'artificial_analysis_intelligence_index' },
  { modelId: 'gpt-6-1-sol', value: 88, metric: 'artificial_analysis_intelligence_index' },
];

test('SuperGrok plan catalog and grok-build-0-1 candidate inclusion', () => {
  assert.equal(SUPERGROK_PLAN.planId, 'supergrok');
  assert.equal(SUPERGROK_PLAN.planName, 'SuperGrok');
  assert.ok(PLAN_CATALOG.some(p => p.planId === 'supergrok'));

  // plansForModel resolves SuperGrok label
  assert.deepEqual(plansForModel('grok-build-0-1'), ['SuperGrok']);
  assert.deepEqual(plansForCatalogModel('grok-build-0-1', PLAN_CATALOG), ['SuperGrok']);
  assert.deepEqual(plansForCatalogModel('grok-build-0-1-06-16', PLAN_CATALOG), ['SuperGrok']);

  // Candidate pool includes grok-build via alias resolution
  const pool = buildCandidatePool(sampleRecords, PLAN_CATALOG);
  const gbRecords = pool.accessibleRecords.filter(r => r.modelId === 'grok-build-0-1');
  assert.ok(gbRecords.length > 0, 'grok-build-0-1 should be in accessible candidate pool');
});

test('computeRoleTop10 renders both roles and preserves existing candidates', () => {
  const lists = computeRoleTop10(sampleRecords);
  assert.ok(lists.orchestrator.entries.length > 0);
  assert.ok(lists.worker.entries.length > 0);

  // Existing top models remain intact
  const orchModels = lists.orchestrator.entries.map(e => e.modelId);
  assert.ok(orchModels.includes('claude-opus-5-5'));
  assert.ok(orchModels.includes('claude-sonnet-5-5'));

  // Section headings are defined for both roles
  assert.ok(SECTION_HEADINGS.orchestrator.includes('오케스트레이터'));
  assert.ok(SECTION_HEADINGS.worker.includes('워커'));
});
