import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { plansForModel } from '../src/insights/letter-top10-plans.js';
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
const cohortOf = (records: readonly Top10RecordInput[]) => {
  const pr = previousRanks(records);
  return (['orchestrator', 'worker'] as const)
    .flatMap(role => [...pr[role]].map(([modelId, rank]) => ({ modelId, rank, metric: role })));
};

test('one candidate pool feeds both lists: intersection appears twice, excluded/inaccessible never', () => {
  const { orchestrator, worker } = computeRoleTop10(RECORDS);
  assert.deepEqual(orchestrator.entries.map(e => e.modelId), ['gpt-6-1-sol', 'claude-opus-5-5', 'claude-haiku-5-5']);
  assert.deepEqual(worker.entries.map(e => e.modelId), ['gpt-6-1-sol', 'claude-opus-5-5', 'claude-haiku-5-5']);
  assert.deepEqual(worker.entries.map(e => e.both), [true, true, true], 'intersection models are marked ↔');
  assert.deepEqual(orchestrator.entries.map(e => e.both), [true, true, true]);
  assert.ok(!orchestrator.entries.some(e => e.modelId === 'unlisted-mega-model'), '보유 요금제 미접근');
  assert.ok(!worker.entries.some(e => e.modelId === 'unlisted-mega-model'), '보유 요금제 미접근');
  assert.ok(!orchestrator.entries.some(e => e.modelId === 'fable-pro'), '제외 계열은 존 계산 전에 걸러진다');
  assert.ok(orchestrator.entries.every(e => e.plans.length > 0));
  assert.equal(orchestrator.entries[0]!.rank, 1);
  assert.equal(orchestrator.entries[0]!.indexText, '88.0');
  assert.match(orchestrator.entries[0]!.scoreText ?? '', /^\d+\.\d$/);
  assert.ok(orchestrator.entries[0]!.scoreComponents);
  assert.equal(worker.entries[0]!.indexText, '80.0');
});

test('missing OpenRouter rank never renders total tokens as a rank', () => {
  const openrouterRecords = [{ modelId: 'claude-opus-5-5', metric: 'total_tokens', value: 264308530787 }];
  const lists = computeRoleTop10(RECORDS, { openrouterRecords });
  const entry = lists.orchestrator.entries.find(e => e.modelId === 'claude-opus-5-5');
  assert.equal(entry?.openrouterRankText, undefined);
});

test('a newer accessible model on another metric removes older GPT grades from the worker pool', () => {
  const records = [row('gpt-6-1-sol', INTEL, 90), row('gpt-5-6-luna', CODE, 84), row('gpt-5-6-terra', CODE, 83), row('gpt-5-6-sol', CODE, 82)];
  const lists = computeRoleTop10(records);
  assert.deepEqual(lists.worker.entries.map(e => e.modelId), ['gpt-6-1-sol']);
  assert.equal(lists.worker.entries[0]!.indexMissing, true);
  assert.equal(lists.worker.entries[0]!.belowZone, true);
  assert.doesNotMatch(renderTop10FromRecords({ publicationDate: '2026-10-12', records }), /gpt-5-6/);
});

test('a model below the worker cutoff fills an available row; a solo candidate passes its own zone', () => {
  const lists = computeRoleTop10(RECORDS);
  assert.ok(lists.orchestrator.entries.some(e => e.modelId === 'claude-haiku-5-5'));
  assert.equal(lists.worker.entries.find(e => e.modelId === 'claude-haiku-5-5')?.belowZone, true, '코딩 40 < 80*0.75');
  const solo = computeRoleTop10([row('claude-haiku-5-5', CODE, 40, [0.8, 4])]);
  assert.deepEqual(solo.worker.entries.map(e => e.modelId), ['claude-haiku-5-5']);
  assert.equal(solo.orchestrator.entries[0]!.indexText, '-');
  assert.equal(solo.orchestrator.entries[0]!.indexMissing, true);
});

test('previous comparison and exits are recomputed per list with the same policy', () => {
  const cohort = cohortOf(RECORDS);
  const lists = computeRoleTop10(RECORDS, { previousCohort: cohort });
  assert.ok(lists.orchestrator.entries.every(e => e.change === '유지'));
  assert.ok(lists.worker.entries.every(e => e.change === '유지'));
  assert.equal(lists.orchestrator.exits.length, 0);
  const shrunken = computeRoleTop10([row('claude-opus-5-5', INTEL, 90, [3, 15]), row('gpt-6-1-sol', INTEL, 88, [1.1, 4.4])],
    { previousCohort: cohort });
  assert.deepEqual(shrunken.orchestrator.exits.map(x => [x.modelId, x.previousRank]), [['claude-haiku-5-5', 3]]);
  assert.deepEqual(shrunken.worker.exits.map(x => x.modelId), ['claude-haiku-5-5']);
  assert.deepEqual([...previousRanks(RECORDS).orchestrator], [['gpt-6-1-sol', 1], ['claude-opus-5-5', 2], ['claude-haiku-5-5', 3]]);
  assert.deepEqual([...previousRanks(RECORDS).worker], [['gpt-6-1-sol', 1], ['claude-opus-5-5', 2], ['claude-haiku-5-5', 3]]);
});

test('successor rows keep the predecessor-index lower bound in both lists', () => {
  const rows: Top10RecordInput[] = [
    { ...row('deepseek-v4.1-flash', INTEL, 69.1, [0.3, 1.2]), successorOf: 'deepseek-v4-flash' },
    { ...row('deepseek-v4.1-flash', CODE, 75, [0.3, 1.2]), successorOf: 'deepseek-v4-flash' },
    row('claude-opus-5-5', INTEL, 80, [3, 15]), row('claude-opus-5-5', CODE, 90, [3, 15])];
  const lists = computeRoleTop10(rows);
  const orch = lists.orchestrator.entries.find(e => e.modelId === 'deepseek-v4-1-flash');
  const worker = lists.worker.entries.find(e => e.modelId === 'deepseek-v4-1-flash');
  assert.equal(orch?.successorOf, 'deepseek-v4-flash');
  assert.equal(worker?.successorOf, 'deepseek-v4-flash');
  assert.equal(orch?.both, true, '두 존을 모두 통과하면 두 목록에 나온다');
});
test('plansForModel keeps the usage-limit annotation that the letters still display', () => {
  assert.ok(plansForModel('kimi-k3').includes('OpenCode Go Plus(440회/5h·추정)'));
  assert.ok(plansForModel('kimi-k3').includes('Ollama Cloud Pro(크레딧 $60/월)'));
});
