import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { plansForModel, shortPlan } from '../src/insights/letter-top10-plans.js';

test('Cursor Plus records price and weekly pooled Grok access only', () => {
  const cursor = PLAN_CATALOG.find(p => p.planId === 'cursor')!;
  assert.equal(cursor.planName, 'Cursor Plus');
  assert.equal(cursor.price, '$8/month');
  assert.equal(cursor.sharedPoolPeriod, 'week');
  assert.deepEqual(cursor.models.map(m => m.modelId), ['grok-4-7', 'grok-4-6', 'grok-4-5']);
  for (const model of cursor.models) {
    assert.equal(model.billing, 'pool');
    assert.equal(model.checkedOn, '2026-10-14');
    assert.equal(model.sourceUrl, 'https://cursor.com/pricing');
    assert.equal(model.usageLimit, undefined, 'pricing page does not publish a count');
  }
  assert.deepEqual(plansForModel('grok-4-7'), ['OpenCode Go Plus', 'Cursor Plus']);
  assert.deepEqual(plansForModel('claude-opus-5-5'), ['Claude Pro', 'Antigravity']);
  assert.ok(!plansForModel('claude-sonnet-5-5').includes('Cursor Plus'));
  assert.ok(!plansForModel('gemini-3-8-flash').includes('Cursor Plus'));
});

test('access labels are plan names only and the compact shortener keeps them terse', () => {
  for (const plan of PLAN_CATALOG) for (const model of plan.models) for (const label of plansForModel(model.modelId))
    assert.ok(!/[()]/.test(label), label);
  assert.equal(shortPlan('Ollama Cloud Pro'), 'Ollama');
  assert.equal(shortPlan('OpenCode Go Plus'), 'Go Plus');
  assert.equal(shortPlan('Cursor Plus'), 'Cursor Plus');
});
