import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { plansForModel } from '../src/insights/letter-top10-plans.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { MODEL_ALIAS_RULES, resolveModelId } from '../src/insights/model-aliases.js';
import { normalizeModelName } from '../src/insights/model-id.js';

const OPEN = 'muse-spark-open', CLOUD_TAG = 'muse-spark-open:cloud';

test('ollama-cloud-pro catalog carries verified Muse Spark Open (#167)', () => {
  const ollama = PLAN_CATALOG.find(p => p.planId === 'ollama-cloud-pro')!;
  const entry = ollama.models.find(m => m.modelId === OPEN)!;
  assert.ok(entry, 'catalog entry exists');
  assert.equal(entry.displayName, 'Muse Spark Open');
  assert.equal(entry.verified, true);
  assert.match(entry.sourceUrl, /^https:\/\//);
  assert.equal(entry.checkedOn, '2026-10-16');
  assert.ok(plansForModel(OPEN).includes('Ollama Cloud Pro'));
  assert.ok(plansForModel('ollama-cloud/muse-spark-open').includes('Ollama Cloud Pro'));
});

test(':cloud tag needs alias to reach canonical, then resolves (#167)', () => {
  assert.notEqual(normalizeModelName(CLOUD_TAG), OPEN); // :cloud는 normalize 유지 실측
  assert.equal(resolveModelId(normalizeModelName(CLOUD_TAG), new Map(), new Set([OPEN])), OPEN);
  const rule = MODEL_ALIAS_RULES.find(r => r.from === CLOUD_TAG)!;
  assert.equal(rule.to, OPEN);
  assert.match(rule.sourceUrl ?? '', /^https:\/\//);
  const pool = buildCandidatePool(
    [{ modelId: 'glm-5-3', value: 90, metric: 'artificial_analysis_intelligence_index' }],
    PLAN_CATALOG,
    [{ modelId: CLOUD_TAG, value: 50, metric: 'total_tokens' }]);
  assert.deepEqual([...new Set(pool.allRecords.map(r => r.modelId))].sort(), ['glm-5-3', OPEN]);
  assert.ok(pool.accessibleRecords.some(r => r.modelId === OPEN));
});

test('Muse Spark Open stays separate from Muse Spark 1.3 (#167)', () => {
  assert.notEqual(normalizeModelName(OPEN), normalizeModelName('muse-spark-1-3'));
  assert.ok(!MODEL_ALIAS_RULES.some(r =>
    (r.from === OPEN && r.to === 'muse-spark-1-3') || (r.from === 'muse-spark-1-3' && r.to === OPEN) ||
    (r.from === CLOUD_TAG && r.to === 'muse-spark-1-3')));
  assert.ok(plansForModel('muse-spark-1-3').includes('OpenCode Go Plus'));
  assert.ok(!plansForModel('muse-spark-1-3').includes('Ollama Cloud Pro'));
  assert.ok(!plansForModel(OPEN).includes('OpenCode Go Plus'));
});

test('catalog alone does not auto-enter Top10 without evidence (#167)', () => {
  const empty = buildCandidatePool([], PLAN_CATALOG);
  assert.ok(!empty.accessibleRecords.some(r => normalizeModelName(r.modelId) === OPEN));
  assert.ok(!empty.allRecords.some(r => normalizeModelName(r.modelId) === OPEN));
  const pool = buildCandidatePool(
    [{ modelId: 'glm-5-3', value: 90, metric: 'artificial_analysis_intelligence_index' }], PLAN_CATALOG);
  assert.ok(pool.accessibleRecords.some(r => r.modelId === 'glm-5-3'));
  assert.ok(!pool.allRecords.some(r => normalizeModelName(r.modelId) === OPEN));
});
