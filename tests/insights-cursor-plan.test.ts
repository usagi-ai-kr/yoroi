import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { plansForModel, shortPlan } from '../src/insights/letter-top10-plans.js';

test('Cursor holds only its own models and never carries third-party access', () => {
  const cursor = PLAN_CATALOG.find(p => p.planId === 'cursor')!;
  assert.deepEqual(cursor.models.map(m => m.modelId), ['grok-4-7', 'grok-4-6', 'grok-4-5', 'composer-2-5']);
  assert.deepEqual(plansForModel('grok-4-7'), ['OpenCode Go Plus', 'Cursor']);
  assert.deepEqual(plansForModel('claude-opus-5-5'), ['Claude Pro', 'Antigravity']);
  assert.ok(!plansForModel('claude-sonnet-5-5').includes('Cursor'));
  assert.ok(!plansForModel('gemini-3-8-flash').includes('Cursor'));
});

test('access labels are plan names only and the compact shortener keeps them terse', () => {
  for (const plan of PLAN_CATALOG) for (const model of plan.models) for (const label of plansForModel(model.modelId))
    assert.ok(!/[()]/.test(label), label);
  assert.equal(shortPlan('Ollama Cloud Pro'), 'Ollama');
  assert.equal(shortPlan('OpenCode Go Plus'), 'Go Plus');
  assert.equal(shortPlan('Cursor'), 'Cursor');
});
