import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { cursorLabelFor, plansForModel } from '../src/insights/letter-top10-plans.js';

test('Cursor splits pool Grok models from API list-price third-party models', () => {
  const cursor = PLAN_CATALOG.find(p => p.planId === 'cursor')!;
  assert.deepEqual(cursor.models.filter(m => m.billing === 'pool').map(m => m.modelId), ['grok-4-7', 'grok-4-6', 'grok-4-5']);
  assert.equal(cursor.models.filter(m => m.billing === 'list-price').length, 8);
  assert.ok(plansForModel('grok-4-7').at(-1) === 'Cursor(주간 풀)' && plansForModel('grok-4-7').includes('OpenCode Go Plus'));
  assert.ok(plansForModel('grok-4-5').at(-1) === 'Cursor(주간 풀)');
  assert.ok(plansForModel('claude-opus-5-5').at(-1) === 'Cursor(API 정가)' && plansForModel('gpt-5-6-luna').at(-1) === 'Cursor(API 정가)');
  for (const model of cursor.models) assert.match(model.sourceUrl, /^https:\/\/cursor\.com\//);
});

test('cursorLabelFor tags the plain Cursor label by billing mode', () => {
  assert.equal(cursorLabelFor('grok-4-7', 'Cursor'), 'Cursor(주간 풀)');
  assert.equal(cursorLabelFor('gemini-3-8-flash', 'Cursor'), 'Cursor(API 정가)');
  assert.equal(cursorLabelFor('kimi-k3', 'Cursor'), 'Cursor(API 정가)');
  assert.equal(cursorLabelFor('kimi-k3', 'Ollama Cloud Pro(크레딧 $60/월)'), 'Ollama Cloud Pro(크레딧 $60/월)');
});
