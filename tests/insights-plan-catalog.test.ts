import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG, type PlanCatalogEntry, type PlanModelEntry } from '../src/insights/plan-catalog.js';
import { plansForModel, freeOnlyModelIds } from '../src/insights/letter-top10-plans.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { normalizeModelName, type Top10RecordInput } from '../src/insights/letter-top10-rank.js';

test('plan catalog entries all carry an https sourceUrl, checkedOn and a verified flag', () => {
  assert.deepEqual(PLAN_CATALOG.map(p => p.planId), ['chatgpt-plus', 'claude-pro', 'google-ai-pro', 'ollama-cloud-pro', 'opencode-go-plus', 'antigravity', 'cursor', 'supergrok']);
  assert.ok(plansForModel('gemini-3-8-flash').includes('Antigravity'));
  for (const plan of PLAN_CATALOG) for (const model of plan.models) {
    assert.match(model.sourceUrl, /^https:\/\//, `${plan.planId}:${model.modelId}`);
    assert.ok(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].includes(model.checkedOn), `${model.modelId} checkedOn`);
    assert.equal(typeof model.verified, 'boolean');
  }
});

test('models with usageLimit append limit to plansForModel', () => {
  const opencode = PLAN_CATALOG.find(p => p.planId === 'opencode-go-plus')!;
  const kimi = opencode.models.find(m => m.modelId === 'kimi-k3')!;
  assert.ok(kimi.usageLimit);
  assert.equal(kimi.usageLimit.count, 440);
  assert.equal(kimi.usageLimit.period, '5h');
  assert.ok(plansForModel('kimi-k3').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('kimi-k3').includes('Ollama Cloud Pro'));
});

test('Ollama Cloud Pro carries usagePolicy credit, pricingModel and concurrency in PLAN_CATALOG', () => {
  const ollama = PLAN_CATALOG.find(p => p.planId === 'ollama-cloud-pro')!;
  assert.ok(ollama.usagePolicy);
  assert.equal(ollama.usagePolicy.credit, '$60/월');
  assert.equal(ollama.usagePolicy.pricingModel, '토큰 단가 차감');
  assert.equal(ollama.usagePolicy.concurrency, 3);
  assert.equal(ollama.usagePolicy.sourceUrl, 'https://ollama.com/pricing');
  assert.equal(ollama.usagePolicy.checkedOn, '2026-10-12');
  assert.ok(plansForModel('gemma4').includes('Ollama Cloud Pro'));
});

test('plansForModel resolves the Go console docs models to OpenCode Go Plus', () => {
  for (const id of ['muse-spark-1-3', 'qwen3-8-max', 'grok-4-7', 'deepseek-v4-flash', 'muse-spark-1-2'])
    assert.ok(plansForModel(id).includes('OpenCode Go Plus'), id);
});

test('each plan keeps its expected model count and no duplicate modelId', () => {
  const counts: Record<string, number> = {
    'chatgpt-plus': 8, 'claude-pro': 3, 'google-ai-pro': 2,
    'ollama-cloud-pro': 18, 'opencode-go-plus': 30, 'antigravity': 9, 'cursor': 3,
    'supergrok': 1,
  };
  assert.deepEqual(Object.fromEntries(PLAN_CATALOG.map(p => [p.planId, p.models.length])), counts);
  for (const plan of PLAN_CATALOG) {
    const ids = plan.models.map(m => m.modelId);
    assert.equal(new Set(ids).size, ids.length, `${plan.planId} duplicate modelId`);
    const norms = plan.models.map(m => normalizeModelName(m.modelId));
    assert.equal(new Set(norms).size, norms.length, `${plan.planId} duplicate normalized modelId`);
  }
});

test('verified=false models are dropped from the accessible candidate pool', () => {
  const entry = (modelId: string, verified = true): PlanModelEntry => ({
    modelId, displayName: modelId, sourceUrl: 'https://example.invalid/pricing',
    checkedOn: '2026-10-13', verified,
  });
  const catalog: PlanCatalogEntry[] = [{
    planId: 'p', planName: 'Plan P', models: [entry('glm-5-3'), entry('muse-spark-1-3', false)],
  }];
  const rows: Top10RecordInput[] = [
    { modelId: 'glm-5-3', value: 90, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'muse-spark-1-3', value: 80, metric: 'artificial_analysis_intelligence_index' },
  ];
  const pool = buildCandidatePool(rows, catalog);
  assert.deepEqual(pool.accessibleRecords.map(r => r.modelId), ['glm-5-3']);
  assert.equal(pool.allRecords.length, 2, 'verified=false는 세대 제외 대상이 아니므로 allRecords에는 남는다');
  const allVerified: PlanCatalogEntry[] = [{
    ...catalog[0]!, models: catalog[0]!.models.map(m => ({ ...m, verified: true })),
  }];
  assert.deepEqual(buildCandidatePool(rows, allVerified).accessibleRecords.map(r => r.modelId).sort(),
    ['glm-5-3', 'muse-spark-1-3']);
});

test('static free plans are gone, so freeOnlyModelIds is empty until codex injects a live freeCatalog', () => {
  assert.equal(PLAN_CATALOG.filter(p => p.tier === 'free').length, 0);
  assert.deepEqual(freeOnlyModelIds(), []);
  assert.ok(!plansForModel('step-5').some(p => p.includes('(Free)')));
});
