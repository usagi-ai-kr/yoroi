import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { EXCLUDED_PATTERNS } from '../src/insights/letter-top10-filter.js';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index', COG = 'cognition_correct';
const row = (modelId: string, metric: string, value: number): Top10RecordInput => ({ modelId, metric, value });
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'free-test', planName: 'Free Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-13', verified: true })) }];

test('orchestrator fills below-zone rows while the worker performance floor removes unqualified candidates', () => {
  const ids = ['fixture-alpha', 'fixture-bravo', 'fixture-charlie', 'fixture-delta', 'fixture-echo', 'fixture-foxtrot', 'fixture-golf', 'fixture-hotel'];
  const special = ['gpt-6-luna', 'claude-haiku-5-5'], catalog = catalogFor([...ids, ...special]);
  const records = ids.flatMap((id, i) => [row(id, INTEL, 100 - i / 2), row(id, CODE, 100 - i / 2)]);
  records.push(row('gpt-6-luna', INTEL, 38.1), row('claude-haiku-5-5', CODE, 39));
  const cognitionRecords = [...ids.map((id, i) => ({ modelId: `${id}-high`, metric: COG, value: 0.9 - 0.005 * i })),
    { modelId: 'gpt-6-luna-max', metric: COG, value: 0.2 }, { modelId: 'claude-haiku-5-5-max', metric: COG, value: 0.3 }];
  const lists = computeRoleTop10(records, { catalog, cognitionRecords });
  assert.equal(lists.orchestrator.entries.length, 10);
  assert.equal(lists.orchestrator.entries.slice(0, 8).some(e => e.belowZone), false);
  assert.deepEqual(lists.orchestrator.entries.slice(8).map(e => [e.modelId, e.scoreText, e.belowZone]), [
    ['claude-haiku-5-5', '11.7', true], ['gpt-6-luna', '0.0', true],
  ]);
  assert.ok(lists.orchestrator.entries.every(e => e.plans.includes('Free Test')));
  // p85: 원값 하한 33 — luna(intel 38.1)는 통과하지만 표준화 성능은 풀 최저라 0.0▽, haiku(intel 없음)는 제외된다.
  assert.equal(lists.worker.entries.length, 9, 'luna passes the raw floor, haiku (no intel) is excluded before fill');
  assert.deepEqual(lists.worker.entries.at(-1), lists.worker.entries.find(e => e.modelId === 'gpt-6-luna'));
  assert.deepEqual([lists.worker.entries.at(-1)!.scoreText, lists.worker.entries.at(-1)!.belowZone], ['0.0', true]);
  assert.ok(!lists.worker.entries.some(e => e.modelId === 'claude-haiku-5-5'), 'intel 없으면 후보에서 제외된다');
  assert.ok(lists.worker.entries.every(e => e.plans.includes('Free Test')));
  const gpt = lists.orchestrator.entries.find(e => e.modelId === 'gpt-6-luna')!;
  const haiku = lists.orchestrator.entries.find(e => e.modelId === 'claude-haiku-5-5')!;
  assert.deepEqual([gpt.rank, gpt.indexText, gpt.indexMissing, gpt.belowZone, gpt.scoreText], [10, '38.1', undefined, true, '0.0']);
  assert.deepEqual([haiku.rank, haiku.indexText, haiku.indexMissing, Math.round((haiku.scoreComponents?.sources?.['performance:cognition'] ?? 0) * 1e6), haiku.scoreText],
    [9, '-', true, Math.round((1 / 7) * 1e6), '11.7']);
  const paid = computeRoleTop10(records, { catalog, cognitionRecords, excludeModelIds: new Set(['gpt-6-luna']) });
  assert.ok(!paid.orchestrator.entries.some(e => e.modelId === 'gpt-6-luna'));
});

test('any dimension qualifies a model (price-only included); orchestrator weighs performance 82% and has no value-for-money (p75)', () => {
  const ids = ['index-peak', 'fallback-near', 'fallback-cheap', 'missing-free', 'missing-paid'];
  const catalog = catalogFor(ids), records: Top10RecordInput[] = [
    row('index-peak', INTEL, 100),
    { ...row('fallback-near', INTEL, 84), priceInput: 1, priceOutput: 1 },
    { ...row('fallback-cheap', INTEL, 40), priceInput: 0, priceOutput: 0 },
    { ...row('missing-free', CODE, 90), priceInput: 0, priceOutput: 0 },
    { ...row('missing-paid', CODE, 80), priceInput: 1, priceOutput: 1 },
  ];
  const entries = computeRoleTop10(records, { catalog }).orchestrator.entries;
  // p75: 가격은 스코어에 쓰지 않는다. 성능 min-max(40~100)만 반영: near (84-40)/60×82, cheap 0.
  assert.deepEqual(entries.map(e => [e.modelId, e.scoreText, e.belowZone]), [['index-peak', '82.0', undefined], ['fallback-near', '60.1', true],
    ['fallback-cheap', '0.0', true], ['missing-free', '0.0', true], ['missing-paid', '0.0', true]]);
  assert.equal(entries[0]!.scoreComponents?.sources?.['price:missing'], undefined);
});

test('fill order follows the score and the representative effort is the highest-scoring variant; cost_per_task is ignored', () => {
  const zone = ['zone-a', 'zone-b', 'zone-c', 'zone-d', 'zone-e', 'zone-f'];
  const ids = [...zone, 'step-5', 'claude-haiku-5-5', 'glm-5-3-flash', 'gemini-3-8-flash', 'gpt-6-luna'];
  const records = [...zone.map((id, i) => row(id, INTEL, 100 - i)), row('step-5', INTEL, 90)];
  records.push(
    row('claude-haiku-5-5-medium', INTEL, 34.5),
    row('claude-haiku-5-5-max', INTEL, 43.4),
    row('claude-haiku-5-5', 'intelligence_index_cost_per_task', 100),
    row('claude-haiku-5-5-medium', 'intelligence_index_cost_per_task', 10),
    row('claude-haiku-5-5-max', 'intelligence_index_cost_per_task', 100),
    row('glm-5-3-flash', INTEL, 41.8), row('gemini-3-8-flash', INTEL, 40.9),
    row('gpt-6-luna-high', INTEL, 32.9),
    row('gpt-6-luna-max', INTEL, 38.1),
    row('gpt-6-luna', 'intelligence_index_cost_per_task', 100),
    row('gpt-6-luna-high', 'intelligence_index_cost_per_task', 10),
    row('gpt-6-luna-max', 'intelligence_index_cost_per_task', 100),
  );
  const catalog = catalogFor(ids), all = computeRoleTop10(records, { catalog }).orchestrator.entries;
  const entries = computeRoleTop10(records, { catalog, excludeModelIds: new Set(['step-5']) }).orchestrator.entries;
  assert.ok(!entries.some(e => e.modelId === 'step-5'));
  const fills = entries.filter(e => e.belowZone);
  assert.deepEqual(fills.map(e => e.modelId), ['claude-haiku-5-5', 'glm-5-3-flash', 'gemini-3-8-flash', 'gpt-6-luna']);
  assert.deepEqual([fills[0]!.repEffort, fills[0]!.indexText], ['max', '43.4']);
  assert.deepEqual([fills[3]!.repEffort, fills[3]!.indexText], ['max', '38.1']);
  for (const id of fills.slice(0, 3).map(e => e.modelId)) {
    const before = all.find(e => e.modelId === id)!, after = entries.find(e => e.modelId === id)!;
    assert.deepEqual([after.repEffort, after.indexText, after.scoreText], [before.repEffort, before.indexText, before.scoreText]);
  }
});

test('Kimi K3 and Grok stay in both role lists after exclusion rollback', () => {
  const ids = ['kimi-k3', 'kimi-k2-6', 'grok-4-6'];
  const catalog = catalogFor(ids);
  const records = ids.flatMap(id => [row(id, INTEL, 100), row(id, CODE, 100)]);
  const lists = computeRoleTop10(records, { catalog, cognitionRecords: ids.map(id => ({ modelId: `${id}-max`, metric: COG, value: 0.5 })) });
  assert.deepEqual(EXCLUDED_PATTERNS, ['fable', 'astra']);
  assert.doesNotMatch(EXCLUSION_NOTE, /Grok|Kimi K3/);
  for (const [role, list] of [['orchestrator', lists.orchestrator], ['worker', lists.worker]] as const) {
    for (const id of ids) assert.ok(list.entries.some(e => e.modelId === id), `${id} stays in ${role}`);
  }
});
