import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelGroup, ModelVariant } from '../src/insights/letter-top10-group.js';
import { selectOptimalZone } from '../src/insights/letter-top10-worker.js';

const group = (id: string, value: number, blendedCost?: number, effectiveCost?: number): ModelGroup => {
  const repVariant: ModelVariant = { modelId: id, baseModelId: id, effort: 'high', value,
    ...(blendedCost !== undefined && { blendedCost }), ...(effectiveCost !== undefined && { effectiveCost }) };
  return { baseModelId: id, repVariant, variants: [repVariant], isPareto: false };
};

test('Pareto compares displayed effective effort cost within each role list', () => {
  const sonnet = group('claude-sonnet-5-5', 46.8, 1.79, 0.65);
  const higherIndex = group('higher-index', 48, 0.8, 0.8);
  for (const role of ['orchestrator', 'worker'] as const) {
    const result = selectOptimalZone([sonnet, higherIndex], role);
    assert.equal(result.find(row => row.group.baseModelId === sonnet.baseModelId)?.group.isPareto, true);
  }
});

test('Pareto falls back to blended cost and withholds stars when price is unknown', () => {
  assert.equal(selectOptimalZone([group('priced', 90, 1)], 'orchestrator')[0]!.group.isPareto, true);
  assert.equal(selectOptimalZone([group('unknown', 90)], 'orchestrator')[0]!.group.isPareto, false);
});
