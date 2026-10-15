import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { applyMixedPriceCap, loadWorkerHeldPlanIds, upliftHeldPlanPriceDimensions, WORKER_HELD_PLAN_IDS } from '../src/insights/letter-top10-worker-price.js';
import { WORKER_HELD_PLAN_IDS_DEFAULT } from '../src/insights/letter-top10-score-policy.js';
import { scoreRoleCandidatesFromSources } from '../src/insights/letter-top10-score.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const catalog: readonly PlanCatalogEntry[] = [{ planId: 'held', planName: 'fixture', models: [
  { modelId: 'held-low', displayName: 'held-low', sourceUrl: 'fixture', checkedOn: '2026-10-15', verified: true },
  { modelId: 'held-high', displayName: 'held-high', sourceUrl: 'fixture', checkedOn: '2026-10-15', verified: true },
  { modelId: 'not-verified', displayName: 'not-verified', sourceUrl: 'fixture', checkedOn: '2026-10-15', verified: false },
] }];

test('held plan IDs use defaults without config and a validated file overrides them', () => {
  const dir = mkdtempSync(join(tmpdir(), 'yoroi-held-plans-'));
  try {
    assert.deepEqual(loadWorkerHeldPlanIds(join(dir, 'missing.json')), WORKER_HELD_PLAN_IDS_DEFAULT);
    const path = join(dir, 'override.json');
    writeFileSync(path, JSON.stringify({ heldPlanIds: ['fixture-held'] }));
    assert.deepEqual(loadWorkerHeldPlanIds(path), ['fixture-held']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('held verified models are raised score-only to the candidate-pool p75', () => {
  assert.ok(WORKER_HELD_PLAN_IDS.includes('chatgpt-plus'));
  assert.deepEqual(upliftHeldPlanPriceDimensions(['held-low', 'unheld', 'held-high', 'not-verified'],
    [0.1, 0.2, 0.8, 0.4], ['held'], catalog), [0.5, 0.2, 0.8, 0.4]);
});

test('the worker scorer uplifts a held plan score dimension without changing AA mixed price', () => {
  const prices = [8, 4, 2, 1];
  const records: Top10RecordInput[] = prices.map((price, i) => ({ modelId: i === 0 ? 'gpt-6-luna' : `fixture-price-${i}`,
    metric: 'artificial_analysis_intelligence_index', value: 90 - i * 5, priceInput: price, priceOutput: price }));
  const held = scoreRoleCandidatesFromSources(records, 'worker').find(x => x.group.baseModelId === 'gpt-6-luna')!;
  assert.ok(Math.abs(held.components.cost - 0.75) < 1e-3);
  assert.equal(held.group.repVariant.blendedCost, 8);
});

test('worker mixed-price cap downgrades only known prices strictly above $5/M', () => {
  const rows = [{ belowZone: false }, { belowZone: false }, { belowZone: false }, { belowZone: true }];
  assert.deepEqual(applyMixedPriceCap('worker', rows, [5.01, 5, undefined, 1]),
    [{ belowZone: true }, { belowZone: false }, { belowZone: false }, { belowZone: true }]);
});

test('the worker scorer applies the cap using AA mixed price while leaving price unchanged', () => {
  const records: Top10RecordInput[] = [
    { modelId: 'fixture-expensive', metric: 'artificial_analysis_intelligence_index', value: 90, priceInput: 6, priceOutput: 6 },
    { modelId: 'fixture-cheap', metric: 'artificial_analysis_intelligence_index', value: 80, priceInput: 1, priceOutput: 1 },
  ];
  const row = scoreRoleCandidatesFromSources(records, 'worker').find(x => x.group.baseModelId === 'fixture-expensive')!;
  assert.equal(row.group.repVariant.blendedCost, 6);
  assert.equal(row.belowZone, true);
});

test('unknown mixed price is allowed, and orchestrator scoring is not price-capped', () => {
  assert.deepEqual(applyMixedPriceCap('worker', [{ belowZone: false }], [undefined]), [{ belowZone: false }]);
  const records: Top10RecordInput[] = [
    { modelId: 'fixture-orchestrator-costly', metric: 'artificial_analysis_intelligence_index', value: 90, priceInput: 7, priceOutput: 7 },
    { modelId: 'fixture-orchestrator-cheap', metric: 'artificial_analysis_intelligence_index', value: 80, priceInput: 1, priceOutput: 1 },
  ];
  const row = scoreRoleCandidatesFromSources(records, 'orchestrator').find(x => x.group.baseModelId === 'fixture-orchestrator-costly')!;
  assert.equal(row.group.repVariant.blendedCost, 7);
  assert.equal(row.belowZone, false);
});
