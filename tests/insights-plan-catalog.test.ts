import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG, type PlanCatalogEntry, type PlanModelEntry } from '../src/insights/plan-catalog.js';
import { plansForModel } from '../src/insights/letter-top10-plans.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { normalizeModelName, type Top10RecordInput } from '../src/insights/letter-top10-rank.js';

test('plan catalog entries all carry an https sourceUrl, checkedOn and a verified flag', () => {
  assert.deepEqual(PLAN_CATALOG.map(p => p.planId), ['chatgpt-plus', 'claude-pro', 'google-ai-pro', 'ollama-cloud-pro', 'opencode-go-plus']);
  for (const plan of PLAN_CATALOG) for (const model of plan.models) {
    assert.match(model.sourceUrl, /^https:\/\//, `${plan.planId}:${model.modelId}`);
    assert.ok(model.checkedOn === '2026-10-12' || model.checkedOn === '2026-10-13', `${model.modelId} checkedOn`);
    assert.equal(typeof model.verified, 'boolean');
  }
});

test('models with usageLimit append limit to plansForModel', () => {
  const opencode = PLAN_CATALOG.find(p => p.planId === 'opencode-go-plus')!;
  const kimi = opencode.models.find(m => m.modelId === 'kimi-k3')!;
  assert.ok(kimi.usageLimit);
  assert.equal(kimi.usageLimit.count, 440);
  assert.equal(kimi.usageLimit.period, '5h');
  assert.ok(plansForModel('kimi-k3').includes('OpenCode Go Plus(440회/5h·추정)'));
  assert.ok(plansForModel('kimi-k3').includes('Ollama Cloud Pro(크레딧 $60/월)'));
});

test('Ollama Cloud Pro carries usagePolicy credit, pricingModel and concurrency in PLAN_CATALOG', () => {
  const ollama = PLAN_CATALOG.find(p => p.planId === 'ollama-cloud-pro')!;
  assert.ok(ollama.usagePolicy);
  assert.equal(ollama.usagePolicy.credit, '$60/월');
  assert.equal(ollama.usagePolicy.pricingModel, '토큰 단가 차감');
  assert.equal(ollama.usagePolicy.concurrency, 3);
  assert.equal(ollama.usagePolicy.sourceUrl, 'https://ollama.com/pricing');
  assert.equal(ollama.usagePolicy.checkedOn, '2026-10-12');
  assert.ok(plansForModel('gemma4').includes('Ollama Cloud Pro(크레딧 $60/월)'));
});

test('plansForModel resolves Muse Spark 1.3 and Step 5 to OpenCode Go Plus', () => {
  assert.ok(plansForModel('muse-spark-1-3').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('step-5').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('qwen3-8-max').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('grok-4-7').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('deepseek-v4-flash').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('muse-spark-1-2').includes('OpenCode Go Plus'));
});

test('each plan keeps its expected model count and no duplicate modelId', () => {
  const counts: Record<string, number> = {
    'chatgpt-plus': 8, 'claude-pro': 3, 'google-ai-pro': 2,
    'ollama-cloud-pro': 18, 'opencode-go-plus': 32,
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
    planId: 'p', planName: 'Plan P', models: [entry('kimi-k3'), entry('muse-spark-1-3', false)],
  }];
  const rows: Top10RecordInput[] = [
    { modelId: 'kimi-k3', value: 90, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'muse-spark-1-3', value: 80, metric: 'artificial_analysis_intelligence_index' },
  ];
  const pool = buildCandidatePool(rows, catalog);
  assert.deepEqual(pool.accessibleRecords.map(r => r.modelId), ['kimi-k3']);
  assert.equal(pool.allRecords.length, 2, 'verified=false는 세대 제외 대상이 아니므로 allRecords에는 남는다');
  const allVerified: PlanCatalogEntry[] = [{
    ...catalog[0]!, models: catalog[0]!.models.map(m => ({ ...m, verified: true })),
  }];
  assert.deepEqual(buildCandidatePool(rows, allVerified).accessibleRecords.map(r => r.modelId).sort(),
    ['kimi-k3', 'muse-spark-1-3']);
});
