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
  row('claude-opus-5-5', INTEL, 90, [1.5, 7]), row('claude-opus-5-5', CODE, 70, [1.5, 7]),
  row('gpt-6-1-sol', INTEL, 88, [1.1, 4.4]), row('gpt-6-1-sol', CODE, 80, [1.1, 4.4]),
  row('claude-haiku-5-5', INTEL, 86, [0.8, 4]), row('claude-haiku-5-5', CODE, 40, [0.8, 4]),
  row('unlisted-mega-model', INTEL, 99, [1, 1]), row('unlisted-mega-model', CODE, 99, [1, 1]),
  row('fable-pro', INTEL, 95, [1, 1]), row('fable-pro', CODE, 95, [1, 1]),
];
const cog = /* p48 워커 근거: Cognition main 정답률(AA 코딩은 참고 표시값) */ (pairs: readonly (readonly [string, number])[]) => pairs.map(([modelId, value]) => ({ modelId, metric: 'cognition_correct', value }));
const COG = cog([['gpt-6-1-sol-high', 0.6], ['claude-opus-5-5-max', 0.55], ['claude-haiku-5-5-max', 0.3], ['unlisted-mega-model-max', 0.9], ['fable-pro-max', 0.9]]);
const W = { cognitionRecords: COG };
const cohortOf = (records: readonly Top10RecordInput[]) => {
  const pr = previousRanks(records, W);
  return (['orchestrator', 'worker'] as const)
    .flatMap(role => [...pr[role]].map(([modelId, rank]) => ({ modelId, rank, metric: role })));
};

test('one candidate pool feeds both lists: intersection appears twice, excluded/inaccessible never', () => {
  const { orchestrator, worker } = computeRoleTop10(RECORDS, W);
  assert.deepEqual(orchestrator.entries.map(e => [e.modelId, e.scoreText]), [['claude-opus-5-5', '82.0'], ['gpt-6-1-sol', '82.0'], ['claude-haiku-5-5', '0.0']],
    'p75 82/6/12·변형 평가: 가성비가 없어 단가는 점수에 쓰지 않는다 → Opus·GPT 성능 1(동점은 모델명), Haiku 성능 0');
  assert.deepEqual(worker.entries.map(e => [e.modelId, e.scoreText]), [['gpt-6-1-sol', '57.4'], ['claude-opus-5-5', '25.0']],
    'p54 워커 30·성능+40·AA 가격 — GPT 1+.685, Opus max(AA .75, Cog .833)+0, Haiku 성능 0 < .70 탈락');
  assert.deepEqual(worker.entries.map(e => e.both), [true, true], 'intersection models are marked in both lists');
  assert.deepEqual(orchestrator.entries.map(e => e.both), [true, true, false], 'Haiku is orchestrator-only after the worker floor');
  assert.ok(!orchestrator.entries.some(e => e.modelId === 'unlisted-mega-model'), '보유 요금제 미접근');
  assert.ok(!worker.entries.some(e => e.modelId === 'unlisted-mega-model'), '보유 요금제 미접근');
  assert.ok(!orchestrator.entries.some(e => e.modelId === 'fable-pro'), '제외 계열은 존 계산 전에 걸러진다');
  assert.ok(orchestrator.entries.every(e => e.plans.length > 0));
  assert.equal(orchestrator.entries[0]!.rank, 1);
  assert.equal(orchestrator.entries[0]!.indexText, '90.0');
  assert.match(orchestrator.entries[0]!.scoreText ?? '', /^\d+\.\d$/); assert.ok(orchestrator.entries[0]!.scoreComponents);
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
  const lists = computeRoleTop10(records, { cognitionRecords: cog([['gpt-6-1-sol-high', 0.4], ['gpt-5-6-luna-high', 0.7],
    ['gpt-5-6-terra-high', 0.6], ['gpt-5-6-sol-high', 0.5]]) });
  assert.deepEqual(lists.worker.entries.map(e => e.modelId), ['gpt-6-1-sol'], 'generation rule runs on Cognition/OR evidence ids');
  assert.equal(lists.worker.entries[0]!.indexMissing, true, 'no AA coding: reference column stays empty');
  assert.equal(lists.worker.entries[0]!.belowZone, undefined, 'a solo evidence candidate passes its own zone');
  assert.doesNotMatch(renderTop10FromRecords({ publicationDate: '2026-10-12', records }), /gpt-5-6/);
});

test('a model below the worker cutoff fills an available row; a solo candidate passes its own zone', () => {
  const lists = computeRoleTop10(RECORDS, W);
  assert.ok(lists.orchestrator.entries.some(e => e.modelId === 'claude-haiku-5-5'));
  assert.deepEqual(lists.worker.entries.map(e => [e.modelId, e.belowZone]), [['gpt-6-1-sol', undefined], ['claude-opus-5-5', true]], '25.0 < 57.4×.75 fills; Haiku < .70 never fills');
  const solo = computeRoleTop10([row('claude-haiku-5-5', CODE, 40, [0.8, 4])], { cognitionRecords: cog([['claude-haiku-5-5-max', 0.3]]) });
  assert.deepEqual(solo.worker.entries.map(e => [e.modelId, e.belowZone]), [['claude-haiku-5-5', undefined]]);
  assert.equal(solo.orchestrator.entries[0]!.indexText, '-');
  assert.equal(solo.orchestrator.entries[0]!.indexMissing, true);
});

test('previous comparison and exits are recomputed per list with the same policy', () => {
  const cohort = cohortOf(RECORDS);
  const lists = computeRoleTop10(RECORDS, { ...W, previousCohort: cohort });
  assert.ok(lists.orchestrator.entries.every(e => e.change === '유지'));
  assert.ok(lists.worker.entries.every(e => e.change === '유지'));
  assert.equal(lists.orchestrator.exits.length, 0);
  const shrunken = computeRoleTop10([row('claude-opus-5-5', INTEL, 90, [1.5, 7]), row('gpt-6-1-sol', INTEL, 88, [1.1, 4.4])],
    { previousCohort: cohort, cognitionRecords: COG.filter(r => !r.modelId.startsWith('claude-haiku')) });
  assert.deepEqual(shrunken.orchestrator.exits.map(x => [x.modelId, x.previousRank]), [['claude-haiku-5-5', 3]]);
  assert.deepEqual(shrunken.worker.exits.map(x => x.modelId), ['claude-opus-5-5'], 'AA Coding 없이 Cog .55 → 성능 0, 하한 탈락으로 이탈');
  assert.deepEqual([...previousRanks(RECORDS).orchestrator], [['claude-opus-5-5', 1], ['gpt-6-1-sol', 2], ['claude-haiku-5-5', 3]], 'AA만: 오케 성능 95% 우선');
  assert.deepEqual([...previousRanks(RECORDS, W).worker], [['gpt-6-1-sol', 1], ['claude-opus-5-5', 2]]);
});

test('successor rows keep the predecessor-index lower bound in both lists', () => {
  const rows: Top10RecordInput[] = [
    { ...row('deepseek-v4.1-flash', INTEL, 69.1, [0.3, 1.2]), successorOf: 'deepseek-v4-flash' },
    { ...row('deepseek-v4.1-flash', CODE, 92, [0.3, 1.2]), successorOf: 'deepseek-v4-flash' }, // 워커 성능 1 → 하한 통과
    row('claude-opus-5-5', INTEL, 80, [1.5, 7]), row('claude-opus-5-5', CODE, 90, [1.5, 7])];
  const lists = computeRoleTop10(rows, { cognitionRecords: cog([['deepseek-v4-1-flash-max', 0.5], ['claude-opus-5-5-max', 0.55]]) });
  const orch = lists.orchestrator.entries.find(e => e.modelId === 'deepseek-v4-1-flash');
  const worker = lists.worker.entries.find(e => e.modelId === 'deepseek-v4-1-flash');
  assert.equal(orch?.successorOf, 'deepseek-v4-flash');
  assert.equal(worker?.successorOf, 'deepseek-v4-flash');
  assert.equal(orch?.both, true, '두 존을 모두 통과하면 두 목록에 나온다');
});
test('plansForModel lists plain plan names now that annotations left the access column', () => {
  assert.deepEqual(plansForModel('kimi-k3'), ['Ollama Cloud Pro', 'OpenCode Go Plus']);
  assert.deepEqual(plansForModel('claude-opus-5-5'), ['Claude Pro', 'Antigravity']);
});
