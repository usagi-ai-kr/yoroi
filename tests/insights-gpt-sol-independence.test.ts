import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { UNCONSTRAINED_AVAILABILITY } from '../src/insights/letter-effort-availability.js';

const MODELS = ['gpt-6-sol', 'gpt-6-1-sol'] as const;
const METRICS = ['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index'];

// 양성 대조: 후속표시 Map이 effort 접미 id에서도 base 키로 저장돼 정상 후속표시가 살아 있어야 한다.
// 이 대조가 통과해야 위 Sol 조합들이 '가드가 없으면 후속표시가 붙는다'는 판별력을 갖는다.
test('effort-suffixed DeepSeek successor keeps its successor annotation', () => {
  const rows = [
    { modelId: 'deepseek-v4.1-flash-high', metric: METRICS[0]!, value: 69.1, priceInput: 0.3, priceOutput: 1.2, successorOf: 'deepseek-v4-flash' },
    { modelId: 'deepseek-v4.1-flash-high', metric: METRICS[1]!, value: 92, priceInput: 0.3, priceOutput: 1.2, successorOf: 'deepseek-v4-flash' },
    { modelId: 'claude-opus-5-5', metric: METRICS[0]!, value: 80, priceInput: 1.5, priceOutput: 7 },
    { modelId: 'claude-opus-5-5', metric: METRICS[1]!, value: 90, priceInput: 1.5, priceOutput: 7 }];
  const lists = computeRoleTop10(rows, { effortAvailability: UNCONSTRAINED_AVAILABILITY });
  assert.equal(lists.orchestrator.entries.find(e => e.modelId === 'deepseek-v4-1-flash')?.successorOf, 'deepseek-v4-flash');
  assert.equal(lists.worker.entries.find(e => e.modelId === 'deepseek-v4-1-flash')?.successorOf, 'deepseek-v4-flash');
});

for (const successor of MODELS) for (const modelEffort of ['', '-high']) for (const predecessorEffort of ['', '-max']) {
  const predecessor = MODELS.find(id => id !== successor)!;
  test(`${successor}${modelEffort} stays independent of ${predecessor}${predecessorEffort} metadata`, () => {
    const records = MODELS.flatMap(modelId => METRICS.map(metric => ({
      modelId: modelId === successor ? `${modelId}${modelEffort}` : modelId,
      metric, value: 90,
      ...(modelId === successor && { successorOf: `${predecessor}${predecessorEffort}` }),
    })));
    const lists = computeRoleTop10(records, { effortAvailability: UNCONSTRAINED_AVAILABILITY });
    for (const list of [lists.orchestrator, lists.worker]) {
      assert.deepEqual(list.entries.map(e => e.modelId).sort(), [...MODELS].sort());
      assert.ok(list.entries.every(e => e.successorOf === undefined));
    }
  });
}
