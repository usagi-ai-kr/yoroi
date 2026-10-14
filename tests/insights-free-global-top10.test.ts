import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
const model = (modelId: string) => ({ modelId, displayName: modelId, verified: true,
  checkedOn: '2026-10-14', sourceUrl: 'https://example.com/models' });
const catalog: readonly PlanCatalogEntry[] = [{ planId: 'paid', planName: 'Paid',
  models: ['paid-a', 'paid-b', 'z-free'].map(model) }];
const freeCatalog: readonly PlanCatalogEntry[] = [{ planId: 'free', planName: 'Free', tier: 'free',
  models: [{ ...model('z-free'), free: true }] }];
const records = ['paid-a', 'paid-b', 'z-free'].flatMap((modelId, i) => ['median_output_tokens_per_second', 'artificial_analysis_intelligence_index'].map(metric => ({ modelId,
  metric, value: metric === 'median_output_tokens_per_second' ? 100 : 50, priceInput: [1, 3, 99][i]!, priceOutput: [1, 3, 99][i]! })));
const openrouterRecords = records.map(({ modelId }) => ({ modelId, metric: 'total_tokens', value: 100 }));
const cognitionRecords = records.map(({ modelId }) => ({ modelId, metric: 'cognition_correct', value: 0.8 }));
const unpriced = ({ priceInput: _input, priceOutput: _output, ...row }: typeof records[number]) => row;
const options = { catalog, freeCatalog, openrouterRecords, cognitionRecords };
test('Free metadata preserves original paid API price and cannot grant a score bonus', () => {
  const withFree = computeRoleTop10(records, options), withoutFree = computeRoleTop10(records, { ...options, freeCatalog: [] });
  for (const role of ['orchestrator', 'worker'] as const) {
    const free = withFree[role].entries.find(e => e.modelId === 'z-free')!;
    const paid = withFree[role].entries.find(e => e.modelId === 'paid-a')!;
    assert.equal(free.blendedCostText, '$99.00/1M');
    assert.ok(Number(free.scoreText) < Number(paid.scoreText));
    assert.equal(free.scoreComponents?.cost, 0);
    assert.deepEqual(withFree[role].entries.map(e => [e.modelId, e.scoreText]),
      withoutFree[role].entries.map(e => [e.modelId, e.scoreText]));
  }
});
test('missing original prices mean zero orchestrator value and worker 99 only against known prices', () => {
  const missing = records.map(r => r.modelId === 'z-free' ? unpriced(r) : r);
  for (const role of ['orchestrator', 'worker'] as const) {
    const e = computeRoleTop10(missing, options)[role].entries.find(e => e.modelId === 'z-free')!;
    assert.equal(e.scoreComponents?.cost, role === 'worker' ? 0.99 : 0);
    assert.equal(e.scoreComponents?.dimensionSources?.price, role === 'worker' ? 'missing' : undefined);
    assert.doesNotMatch(e.blendedCostText, /무료|\$0/);
    const noPrices = records.map(unpriced);
    assert.ok(computeRoleTop10(noPrices, options)[role].entries.every(e => e.scoreComponents?.cost === 0));
  }
});
test('observed original zero prices remain zero without relying on a Free path', () => {
  const zero = records.map(r => r.modelId === 'z-free' ? { ...r, priceInput: 0, priceOutput: 0 } : r);
  for (const role of ['orchestrator', 'worker'] as const) {
    const e = computeRoleTop10(zero, options)[role].entries.find(e => e.modelId === 'z-free')!;
    assert.equal(e.scoreComponents?.cost, 1);
    assert.equal(e.scoreComponents?.dimensionSources?.price, 'aa');
  }
});
test('Free access alone ranks in orchestrator but cannot bypass the worker performance floor', () => {
  const priced = [{ modelId: 'paid-a', metric: 'price_1m_input_tokens', value: 1, priceInput: 1, priceOutput: 1 }];
  for (const role of ['orchestrator', 'worker'] as const) {
    const entries = computeRoleTop10(priced, { catalog, freeCatalog })[role].entries;
    if (role === 'worker') { assert.equal(entries.length, 0, 'price/access evidence lacks qualifying performance'); continue; }
    const e = entries.find(e => e.modelId === 'z-free')!;
    assert.ok(e);
    assert.equal(e.scoreComponents?.cost, 0);
    assert.equal(e.scoreComponents?.dimensionSources?.price, undefined);
    assert.doesNotMatch(e.blendedCostText, /무료/);
  }
});
