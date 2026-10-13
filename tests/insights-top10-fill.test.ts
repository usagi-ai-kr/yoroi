import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { EXCLUDED_PATTERNS } from '../src/insights/letter-top10-filter.js';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const row = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'free-test', planName: 'Free Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true })) }];

test('fills ten zone-first rows and keeps missing role indexes at zero in a full injected pool', () => {
  const ids = ['fixture-alpha', 'fixture-bravo', 'fixture-charlie', 'fixture-delta', 'fixture-echo', 'fixture-foxtrot', 'fixture-golf', 'fixture-hotel'];
  const special = ['gpt-6-luna', 'claude-haiku-5-5'], catalog = catalogFor([...ids, ...special]);
  const records = ids.flatMap((id, i) => [row(id, INTEL, 100 - i), row(id, CODE, 100 - i)]);
  records.push(row('gpt-6-luna', INTEL, 38.1), row('claude-haiku-5-5', CODE, 39));
  const lists = computeRoleTop10(records, { catalog });
  for (const list of [lists.orchestrator, lists.worker]) {
    assert.equal(list.entries.length, 10);
    assert.equal(list.entries.slice(0, 8).some(e => e.belowZone), false);
    assert.equal(list.entries.slice(8).every(e => e.belowZone), true);
    assert.ok(list.entries.every(e => e.plans.includes('Free Test')));
  }
  const gpt = lists.orchestrator.entries.find(e => e.modelId === 'gpt-6-luna')!;
  const haiku = lists.orchestrator.entries.find(e => e.modelId === 'claude-haiku-5-5')!;
  assert.deepEqual([gpt.rank, gpt.indexText, gpt.indexMissing, gpt.belowZone], [9, '38.1', undefined, true]);
  assert.deepEqual([haiku.rank, haiku.indexText, haiku.indexMissing, haiku.scoreComponents?.index], [10, '-', true, 0]);
  assert.equal(lists.worker.entries.find(e => e.modelId === 'gpt-6-luna')?.scoreComponents?.index, 0);
  const paid = computeRoleTop10(records, { catalog, excludeModelIds: new Set(['gpt-6-luna']) });
  assert.ok(!paid.orchestrator.entries.some(e => e.modelId === 'gpt-6-luna'));
});

test('below-zone fill lowers the index floor first and puts missing indexes last by score', () => {
  const ids = ['index-peak', 'fallback-near', 'fallback-cheap', 'missing-free', 'missing-paid'];
  const catalog = catalogFor(ids), records: Top10RecordInput[] = [
    row('index-peak', INTEL, 100),
    { ...row('fallback-near', INTEL, 84), priceInput: 1, priceOutput: 1 },
    { ...row('fallback-cheap', INTEL, 40), priceInput: 0, priceOutput: 0 },
    { ...row('missing-free', CODE, 90), priceInput: 0, priceOutput: 0 },
    { ...row('missing-paid', CODE, 80), priceInput: 1, priceOutput: 1 },
  ];
  const entries = computeRoleTop10(records, { catalog }).orchestrator.entries;
  assert.deepEqual(entries.map(e => e.modelId), ids);
  assert.ok(Number(entries[1]!.scoreText) < Number(entries[2]!.scoreText), 'near-threshold index outranks the cheaper, higher-score fallback');
  assert.deepEqual(entries.slice(3).map(e => e.indexMissing), [true, true]);
  assert.ok(Number(entries[3]!.scoreText) > Number(entries[4]!.scoreText), 'missing-index fillers remain score-sorted');
});

test('fallback order uses maximum effort index while displaying the selected representative', () => {
  const zone = ['zone-a', 'zone-b', 'zone-c', 'zone-d', 'zone-e', 'zone-f'];
  const ids = [...zone, 'step-5', 'claude-haiku-5-5', 'glm-5-3-flash', 'gemini-3-8-flash', 'gpt-6-luna'];
  const records = [...zone.map((id, i) => row(id, INTEL, 100 - i)), row('step-5', INTEL, 90)];
  records.push(
    { ...row('claude-haiku-5-5-medium', INTEL, 34.5), priceInput: 1, priceOutput: 1 },
    { ...row('claude-haiku-5-5-max', INTEL, 43.4), priceInput: 1, priceOutput: 1 },
    row('claude-haiku-5-5', 'intelligence_index_cost_per_task', 100),
    row('claude-haiku-5-5-medium', 'intelligence_index_cost_per_task', 10),
    row('claude-haiku-5-5-max', 'intelligence_index_cost_per_task', 100),
    row('glm-5-3-flash', INTEL, 41.8), row('gemini-3-8-flash', INTEL, 40.9),
    { ...row('gpt-6-luna-high', INTEL, 32.9), priceInput: 1, priceOutput: 1 },
    { ...row('gpt-6-luna-max', INTEL, 38.1), priceInput: 1, priceOutput: 1 },
    row('gpt-6-luna', 'intelligence_index_cost_per_task', 100),
    row('gpt-6-luna-high', 'intelligence_index_cost_per_task', 10),
    row('gpt-6-luna-max', 'intelligence_index_cost_per_task', 100),
  );
  const catalog = catalogFor(ids), all = computeRoleTop10(records, { catalog }).orchestrator.entries;
  const entries = computeRoleTop10(records, { catalog, excludeModelIds: new Set(['step-5']) }).orchestrator.entries;
  assert.ok(!entries.some(e => e.modelId === 'step-5'));
  const fills = entries.filter(e => e.belowZone);
  assert.deepEqual(fills.map(e => e.modelId), ['claude-haiku-5-5', 'glm-5-3-flash', 'gemini-3-8-flash', 'gpt-6-luna']);
  assert.deepEqual([fills[0]!.repEffort, fills[0]!.indexText], ['medium', '34.5']);
  assert.deepEqual([fills[3]!.repEffort, fills[3]!.indexText], ['high', '32.9']);
  for (const id of fills.slice(0, 3).map(e => e.modelId)) {
    const before = all.find(e => e.modelId === id)!, after = entries.find(e => e.modelId === id)!;
    assert.deepEqual([after.repEffort, after.indexText, after.scoreText], [before.repEffort, before.indexText, before.scoreText]);
  }
});

test('Kimi K3 and Grok stay in both role lists after exclusion rollback', () => {
  const ids = ['kimi-k3', 'kimi-k2-6', 'grok-4-6'];
  const catalog = catalogFor(ids);
  const records = ids.flatMap((id, i) => [row(id, INTEL, 100 - i), row(id, CODE, 100 - i)]);
  const lists = computeRoleTop10(records, { catalog });
  assert.deepEqual(EXCLUDED_PATTERNS, ['fable', 'astra']);
  assert.doesNotMatch(EXCLUSION_NOTE, /Grok|Kimi K3/);
  for (const [role, list] of [['orchestrator', lists.orchestrator], ['worker', lists.worker]] as const) {
    for (const id of ids) assert.ok(list.entries.some(e => e.modelId === id), `${id} stays in ${role}`);
  }
});
