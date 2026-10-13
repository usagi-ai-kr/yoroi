import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { plansForModel, shortPlan } from '../src/insights/letter-top10-plans.js';

test('Cursor keeps pool/list-price billing as catalog fact but renders the plain label', () => {
  const cursor = PLAN_CATALOG.find(p => p.planId === 'cursor')!;
  const pool = cursor.models.filter(m => m.billing === 'pool');
  assert.deepEqual(pool.map(m => m.modelId), ['grok-4-7', 'grok-4-6', 'grok-4-5']);
  assert.equal(cursor.models.length - pool.length, 8);
  assert.ok(plansForModel('grok-4-7').at(-1) === 'Cursor' && plansForModel('grok-4-7').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('claude-opus-5-5').at(-1) === 'Cursor' && plansForModel('gpt-5-6-luna').at(-1) === 'Cursor');
  for (const label of PLAN_CATALOG.flatMap(p => p.models.flatMap(m => plansForModel(m.modelId))))
    assert.ok(!label.includes('주간 풀') && !label.includes('API 정가'), label);
});

test('compact shortens the plain Cursor label without parenthetical notes', () => {
  assert.equal(shortPlan('Cursor'), 'Cursor');
  assert.equal(shortPlan('Ollama Cloud Pro(크레딧 $60/월)'), 'Ollama');
  assert.equal(shortPlan('OpenCode Go Plus(440회/5h·추정)'), 'Go Plus');
});
