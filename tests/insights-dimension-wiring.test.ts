import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCognitionTop10Records } from '../src/insights/cognition-top10.js';
import { top10OptionsFrom } from '../src/insights/letter-top10-render-options.js';
import { buildFreeCatalog, parseOpenCodeFreeModels } from '../src/insights/opencode-free-models.js';
import type { ValidatedInsightRecord } from '../src/insights/validation.js';

const input = (metric: string, value: number, subset = 'main'): ValidatedInsightRecord => ({ comparisonDate: null,
  record: { source: 'cognition', modelId: 'GPT-6 Luna', metric, value, unit: 'ratio', category: 'main', observedAt: '2026-10-13T00:00:00Z',
    sourceAsOf: '2026-10-13', sourceUrl: 'https://cognition.com', sourceName: 'Cognition', license: null, attributionText: 'fixture',
    method: 'fixture', schemaVersion: 'cognition-v1', metadata: { subset, effort: 'high' } } });

test('composition render options carry runtime Free paths and current Cognition dimensions', () => {
  const cognitionRecords = buildCognitionTop10Records([input('correct', 0.8), input('cost', 0), input('duration_min', 12),
    input('duration_min', 0), input('cost', 2, 'extended')]);
  assert.deepEqual(cognitionRecords, [
    { modelId: 'gpt-6-luna-high', metric: 'cognition_correct', value: 0.8 },
    { modelId: 'gpt-6-luna-high', metric: 'cognition_cost', value: 0 },
    { modelId: 'gpt-6-luna-high', metric: 'cognition_duration_min', value: 12 },
  ]);
  const freeCatalog = buildFreeCatalog(parseOpenCodeFreeModels('opencode/step-5-free'), '2026-10-13');
  const options = top10OptionsFrom({ cognitionRecords, freeCatalog });
  assert.deepEqual(options.freeCatalog, freeCatalog);
  assert.deepEqual(options.cognitionRecords, cognitionRecords);
  assert.equal(options.excludeModelIds, undefined);
});
