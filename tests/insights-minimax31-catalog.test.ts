import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { MODEL_ALIAS_RULES, resolveModelId } from '../src/insights/model-aliases.js';
import { splitBaseAndEffort } from '../src/insights/letter-top10-group.js';
import { freeOnlyModelIds, plansForModel } from '../src/insights/letter-top10-plans.js';
import { normalizeModelName } from '../src/insights/letter-top10-rank.js';

/** #190 MiniMax M3.1 Flash: 공식 문서 근거만으로 접근 경로를 연다. 점수 이식 없음. */
const entry = PLAN_CATALOG.find(p => p.planId === 'opencode-go-plus')!.models
  .find(m => m.modelId === 'minimax-m3-1-flash-free')!;

test('catalog entry carries official grounds only', () => {
  assert.equal(entry.displayName, 'MiniMax M3.1 Flash Free');
  assert.equal(entry.sourceUrl, 'https://opencode.ai/v2/docs/console/go');
  assert.equal(entry.checkedOn, '2026-10-20');
  assert.equal(entry.verified, true);
  assert.equal(entry.free, true);
  assert.ok(entry.note!.includes('limited time'));
});

test('explicit alias bridges the -free suffix gap', () => {
  const rule = MODEL_ALIAS_RULES.find(r => r.from === 'minimax-m3-1-flash-free')!;
  assert.equal(rule.to, 'minimax-m3-1-flash');
  assert.equal(rule.checkedOn, '2026-10-20');
  assert.ok(rule.sourceUrl!.includes('opencode.ai'));
  const universe = new Set(['minimax-m3-1-flash']);
  assert.equal(resolveModelId('minimax-m3-1-flash-free', new Map(), universe), 'minimax-m3-1-flash');
  assert.equal(splitBaseAndEffort('minimax-m3-1-flash-free').base, 'minimax-m3-1-flash-free');
});

test('space-bunny stays separate and access paths resolve', () => {
  assert.equal(resolveModelId('space-bunny', new Map(), new Set(['space-bunny'])), 'space-bunny');
  const bunny = PLAN_CATALOG.flatMap(p => p.models).find(m => m.modelId === 'space-bunny')!;
  assert.ok(bunny.note!.includes('별개 id 유지'));
  assert.ok(plansForModel('minimax-m3-1-flash-free').includes('OpenCode Go Plus'));
  assert.ok(freeOnlyModelIds().includes(normalizeModelName('minimax-m3-1-flash-free')));
});
