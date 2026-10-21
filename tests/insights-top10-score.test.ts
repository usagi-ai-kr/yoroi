import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { computeRoleList } from '../src/insights/letter-top10-messenger.js';
import { applyMixedPriceCap } from '../src/insights/letter-top10-worker-price.js';
import { banSetFor } from '../src/insights/letter-model-lists.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { UNCONSTRAINED_AVAILABILITY } from '../src/insights/letter-effort-availability.js';

/** U2: 메신저 단일 경로. 워커와 같은 배관 + 메신저 가중치·임계. 실측 고정, 날조 없음. */
const INTEL = 'artificial_analysis_intelligence_index', TPS = 'median_output_tokens_per_second';
const CPT = 'intelligence_index_cost_per_task';
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'c-test', planName: 'C Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true })) }];
const rec = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });

test('messenger reuses worker pipeline with messenger weights (speed outranking)', () => {
  const records = [rec('m-fast', INTEL, 60), rec('m-fast', TPS, 500),
    { modelId: 'm-fast', metric: INTEL, value: 60, priceInput: 0.5, priceOutput: 0.5 }, { modelId: 'm-fast', metric: CPT, value: 0.1 },
    rec('m-slow', INTEL, 65), rec('m-slow', TPS, 50),
    { modelId: 'm-slow', metric: INTEL, value: 65, priceInput: 0.5, priceOutput: 0.5 }, { modelId: 'm-slow', metric: CPT, value: 0.1 }];
  const opts = { catalog: catalogOf(['m-fast', 'm-slow']), effortAvailability: UNCONSTRAINED_AVAILABILITY };
  const w = computeRoleList(records, 'worker', opts), m = computeRoleList(records, 'messenger', opts);
  assert.deepEqual(w.entries.map(e => e.modelId), ['m-slow', 'm-fast']);
  assert.deepEqual(w.entries.map(e => e.rawScore?.toFixed(2)), ['70.00', '50.00']);
  assert.deepEqual(m.entries.map(e => e.modelId), ['m-fast', 'm-slow']);
  assert.deepEqual(m.entries.map(e => e.rawScore?.toFixed(2)), ['70.00', '60.00']);
  const top = computeRoleTop10(records, opts);
  assert.deepEqual(top.worker.entries.map(e => e.modelId), w.entries.map(e => e.modelId));
  assert.deepEqual(top.worker.entries.map(e => e.rawScore?.toFixed(2)), w.entries.map(e => e.rawScore?.toFixed(2)));
});

test('messenger shares worker pipeline: missing price, floor, cap, ties, unconfirmed, ban', () => {
  const r2 = [rec('p-have', INTEL, 60), rec('p-have', TPS, 100), { modelId: 'p-have', metric: CPT, value: 0.5 },
    rec('p-miss', INTEL, 60), rec('p-miss', TPS, 100)];
  const m2 = computeRoleList(r2, 'messenger', { catalog: catalogOf(['p-have', 'p-miss']), effortAvailability: UNCONSTRAINED_AVAILABILITY });
  const have = m2.entries.find(e => e.modelId === 'p-have')!, miss = m2.entries.find(e => e.modelId === 'p-miss')!;
  assert.deepEqual([have.rawScore?.toFixed(2), have.scoreComponents?.dimensionSources?.price], ['90.00', 'aa']);
  assert.deepEqual([miss.rawScore?.toFixed(2), miss.scoreComponents?.dimensionSources?.price,
    miss.scoreComponents?.sources?.['price:missing']], ['89.60', 'missing', 0.99]);
  const r3 = [rec('ok', INTEL, 60), rec('ok', TPS, 100), rec('weak', INTEL, 20), rec('weak', TPS, 500)];
  assert.deepEqual(computeRoleList(r3, 'messenger',
    { catalog: catalogOf(['ok', 'weak']), effortAvailability: UNCONSTRAINED_AVAILABILITY }).entries.map(e => e.modelId), ['ok']);
  assert.deepEqual(applyMixedPriceCap('messenger', [{ belowZone: false }], [5.01]), [{ belowZone: true }]);
  assert.deepEqual(applyMixedPriceCap('messenger', [{ belowZone: false }], [5]), [{ belowZone: false }]);
  assert.deepEqual(applyMixedPriceCap('orchestrator', [{ belowZone: false }], [99]), [{ belowZone: false }]);
  const rt = [rec('t-b', INTEL, 60), rec('t-b', TPS, 100), { modelId: 't-b', metric: CPT, value: 0.5 },
    rec('t-a', INTEL, 60), rec('t-a', TPS, 100), { modelId: 't-a', metric: CPT, value: 0.5 }];
  assert.deepEqual(computeRoleList(rt, 'messenger',
    { catalog: catalogOf(['t-a', 't-b']), effortAvailability: UNCONSTRAINED_AVAILABILITY }).entries.map(e => [e.modelId, e.rawScore?.toFixed(2)]),
    [['t-a', '90.00'], ['t-b', '90.00']]);
  const ru = [rec('real', INTEL, 60), rec('real', TPS, 100), { modelId: 'real', metric: CPT, value: 0.5 },
    rec('ghost', INTEL, 99), rec('ghost', TPS, 999), { modelId: 'ghost', metric: CPT, value: 0.01 }];
  assert.deepEqual(computeRoleList(ru, 'messenger',
    { catalog: catalogOf(['real']), effortAvailability: UNCONSTRAINED_AVAILABILITY }).entries.map(e => e.modelId), ['real']);
  const lists = { allowOlder: [], excludePatterns: [], ban: { common: ['x'], orchestrator: ['o'], worker: ['w'] } };
  assert.deepEqual([...banSetFor(lists, 'messenger')].sort(), [...banSetFor(lists, 'worker')].sort());
});
