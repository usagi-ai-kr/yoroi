import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG, type PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import { computePlanOptimal, renderPlanOptimalLines } from '../src/insights/plan-optimal.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const entry = (modelId: string, displayName: string, verified = true) =>
  ({ modelId, displayName, sourceUrl: 'https://example.invalid/pricing', checkedOn: '2026-10-12', verified });
const catalog: PlanCatalogEntry[] = [{ planId: 'p', planName: 'Plan P', models: [
  entry('a', 'A'), entry('b', 'B'), entry('c', 'C'), entry('d', 'D', false), entry('grok-code', 'Grok Code')] }];
const idx = 'artificial_analysis_intelligence_index';
const row = (modelId: string, value: number, metric = idx): Top10RecordInput => ({ modelId, value, metric, priceInput: 1, priceOutput: 1 });
const records: Top10RecordInput[] = [row('a', 100), row('b', 90), row('c', 80), row('d', 95), row('x', 92),
  row('a-high', 50, 'artificial_analysis_coding_index'), row('grok-code', 300)];

test('plan catalog entries all carry an https sourceUrl, checkedOn and a verified flag', () => {
  assert.deepEqual(PLAN_CATALOG.map(p => p.planId), ['chatgpt-plus', 'claude-pro', 'google-ai-pro', 'ollama-cloud-pro', 'opencode-go-plus']);
  for (const plan of PLAN_CATALOG) for (const model of plan.models) {
    assert.match(model.sourceUrl, /^https:\/\//, `${plan.planId}:${model.modelId}`);
    assert.equal(model.checkedOn, '2026-10-12'); assert.equal(typeof model.verified, 'boolean');
  }
  assert.equal(PLAN_CATALOG.find(p => p.planId === 'opencode-go-plus')!.models.length, 13);
});

test('the GLOBAL optimal-zone cutoff applies: plan-local highs below the global threshold are dropped', () => {
  const [result] = computePlanOptimal(records, 'orchestrator', catalog);
  assert.equal(result!.planId, 'p');
  assert.deepEqual(result!.entries.map(e => e.displayName), ['A', 'B']); // 전역 max 100(미등재 x 포함) → 85
  const narrow: PlanCatalogEntry[] = [{ planId: 'n', planName: 'Narrow', models: [entry('c', 'C')] }];
  const [empty] = computePlanOptimal([...records, row('z', 200)], 'orchestrator', narrow);
  assert.deepEqual(empty!.entries, []); // 80 < 200*0.85 → 전역 하한 미달
  assert.equal(empty!.bestIndexValue, 80);
});

test('worker role reads the coding metric and effort variants map to their base entry', () => {
  const [result] = computePlanOptimal(records, 'worker', catalog);
  assert.deepEqual(result!.entries.map(e => [e.displayName, e.indexValue]), [['A', 50]]);
});

test('the #103 exclusions apply inside plans: a verified grok entry never renders', () => {
  const grokOnly: PlanCatalogEntry[] = [{ planId: 'z', planName: 'Z', models: [entry('grok-code', 'Grok Code')] }];
  assert.deepEqual(computePlanOptimal(records, 'orchestrator', grokOnly), []);
});

test('renderPlanOptimalLines marks a plan with no zone member as 최적 존 해당 없음 · 최고 X', () => {
  const narrow: PlanCatalogEntry[] = [{ planId: 'n', planName: 'Narrow', models: [entry('c', 'C')] }];
  const lines = renderPlanOptimalLines([...records, row('z', 200)], narrow);
  assert.ok(lines.some(l => l.includes('Narrow') && l.includes('최적 존 해당 없음') && l.includes('최고 80.0')), JSON.stringify(lines));
});
test('renderPlanOptimalLines emits the section with index-order rows and the flat-rate note', () => {
  const lines = renderPlanOptimalLines(records, catalog);
  assert.equal(lines[0], '## 요금제상 최적');
  assert.match(lines[1]!, /^- Plan P: 오케 A 100\.0 > B 90\.0 · 워커 A 50\.0$/);
  assert.match(lines.at(-1)!, /지수 순/);
  assert.deepEqual(renderPlanOptimalLines([row('x', 90)], catalog), []);
});
