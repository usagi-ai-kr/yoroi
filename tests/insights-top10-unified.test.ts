import assert from 'node:assert/strict';
import test from 'node:test';
import { computeUnifiedTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const row = (modelId: string, metric: string, value: number, price?: [number, number]): Top10RecordInput =>
  ({ modelId, metric, value, ...(price && { priceInput: price[0], priceOutput: price[1] }) });
const RECORDS: readonly Top10RecordInput[] = [
  row('claude-opus-5-5', INTEL, 90, [3, 15]), row('claude-opus-5-5', CODE, 70, [3, 15]),
  row('gpt-6-1-sol', INTEL, 88, [1.1, 4.4]), row('gpt-6-1-sol', CODE, 80, [1.1, 4.4]),
  row('claude-haiku-5-5', INTEL, 86, [0.8, 4]), row('claude-haiku-5-5', CODE, 40, [0.8, 4]),
  row('unlisted-mega-model', INTEL, 99, [1, 1]), row('unlisted-mega-model', CODE, 99, [1, 1]),
  row('fable-pro', INTEL, 95, [1, 1]), row('fable-pro', CODE, 95, [1, 1]),
];

test('unified top10 marks roles per passed zone and drops non-accessible or non-passing models', () => {
  const { entries } = computeUnifiedTop10(RECORDS);
  const ids = entries.map(e => e.modelId);
  assert.ok(ids.includes('claude-opus-5-5') && ids.includes('gpt-6-1-sol') && ids.includes('claude-haiku-5-5'));
  assert.ok(!ids.includes('unlisted-mega-model')); // 보유 요금제 미접근
  assert.ok(!ids.includes('fable-pro'));           // 제외 계열은 존 계산 전에 걸러진다
  const opus = entries.find(e => e.modelId === 'claude-opus-5-5')!;
  assert.deepEqual(opus.roles, ['orchestrator', 'worker']);
  assert.equal(opus.roleLabel, '🧭+🛠️ 둘 다');
  assert.ok(opus.indexText.includes('오케 90.0') && opus.indexText.includes('워커 70.0'));
  assert.ok(entries.every(e => e.plans.length > 0));
  assert.equal(entries[0]!.rank, 1);
});
test('a model below both cutoffs is excluded; haiku passes only the orchestrator zone', () => {
  const haiku = computeUnifiedTop10(RECORDS).entries.find(e => e.modelId === 'claude-haiku-5-5')!;
  assert.deepEqual(haiku.roles, ['orchestrator']); // 코딩 40 < 80*0.75
  assert.equal(haiku.roleLabel, '🧭 오케');
  const solo = computeUnifiedTop10([row('claude-haiku-5-5', CODE, 40, [0.8, 4])]).entries;
  assert.deepEqual(solo.map(e => e.roles), [['worker']]); // 단독 후보는 자기 존을 통과한다
});
test('previous comparison recomputes with the same unified policy', () => {
  const prevRows = [...previousRanks(RECORDS)].map(([modelId, rank]) => ({ modelId, rank, metric: 'rank' }));
  const withPrev = computeUnifiedTop10(RECORDS, { previousCohort: prevRows });
  assert.ok(withPrev.entries.every(e => e.change === '유지'));
  assert.equal(withPrev.exits.length, 0);
  const shrunken = computeUnifiedTop10([RECORDS[0]!, RECORDS[2]!], { previousCohort: prevRows });
  assert.ok(shrunken.exits.some(x => x.modelId === 'claude-haiku-5-5'));
  assert.deepEqual([...previousRanks(RECORDS)], [['claude-haiku-5-5', 1], ['gpt-6-1-sol', 2], ['claude-opus-5-5', 3]]);
});
test('successorOf rows are labeled with the predecessor-index lower bound', () => {
  const rows = RECORDS.map(r => r.modelId === 'claude-haiku-5-5' && r.metric === INTEL
    ? { ...r, successorOf: 'claude-sonnet-5-5' } : r);
  const haiku = computeUnifiedTop10(rows).entries.find(e => e.modelId === 'claude-haiku-5-5')!;
  assert.equal(haiku.successorOf, 'claude-sonnet-5-5');
});
