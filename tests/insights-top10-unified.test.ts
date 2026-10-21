import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { plansForModel } from '../src/insights/letter-top10-plans.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import { UNCONSTRAINED_AVAILABILITY } from '../src/insights/letter-effort-availability.js';
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
  const pr = previousRanks(records, { ...W, effortAvailability: UNCONSTRAINED_AVAILABILITY });
  return (['orchestrator', 'worker'] as const)
    .flatMap(role => [...pr[role]].map(([modelId, rank]) => ({ modelId, rank, metric: role })));
};
test('one candidate pool feeds both lists: intersection appears twice, excluded/inaccessible never', () => {
  const { orchestrator, worker } = computeRoleTop10(RECORDS, { ...W, effortAvailability: UNCONSTRAINED_AVAILABILITY });
  assert.deepEqual(orchestrator.entries.map(e => [e.modelId, e.rawScore?.toFixed(1)]), [['gpt-6-1-sol', '85.5'], ['claude-opus-5-5', '75.0'], ['claude-haiku-5-5', '15.0']],
    '1.2.1 75/0/10/15·사용량 제외: sol 가성비 1로 1위, opus 성능 75.0, haiku는 O 허용으로 3위 합류');
  assert.deepEqual(worker.entries.map(e => [e.modelId, e.rawScore?.toFixed(1)]), [['claude-opus-5-5', '67.9'], ['gpt-6-1-sol', '53.7'], ['claude-haiku-5-5', '40.0']],
    '사용자 확정 워커 30/20/10/40+가산·p75 상향·.60 존 — 가격 차원 풀 [0, .6848, 1]의 p75=.8424로 보유 모델 상향: opus 100×(0.3×1+0.4×.8424)+4.2=67.9, gpt 100×(0.3×.5+0.4×.8424)+5=53.7, haiku 100×(0.4×1)=40.0');
  assert.deepEqual(worker.entries.map(e => e.both), [true, true, true], 'haiku는 양쪽에(O 허용이라 교집합)');
  assert.deepEqual(orchestrator.entries.map(e => e.both), [true, true, true], 'Haiku도 intel이 있어 워커에 남는다');
  assert.ok(!orchestrator.entries.some(e => e.modelId === 'unlisted-mega-model'), '보유 요금제 미접근');
  assert.ok(!worker.entries.some(e => e.modelId === 'unlisted-mega-model'), '보유 요금제 미접근');
  assert.ok(!orchestrator.entries.some(e => e.modelId === 'fable-pro'), '제외 계열은 존 계산 전에 걸러진다');
  assert.ok(orchestrator.entries.every(e => e.plans.length > 0));
  assert.equal(orchestrator.entries[0]!.rank, 1);
  assert.equal(orchestrator.entries.find(e => e.modelId === 'claude-opus-5-5')!.indexText, '90.0', 'R에서 sol이 1위여도 opus 지수는 그대로다');
  assert.match(orchestrator.entries[0]!.scoreText ?? '', /^\d+\.\d\d$/); assert.ok(orchestrator.entries[0]!.scoreComponents);
  assert.ok(orchestrator.entries.every(e => e.scoreText === '-' || (e.scoreKey !== undefined && Number(e.scoreText).toFixed(1) === e.scoreKey.toFixed(1))), '비교 키는 표시의 1자리 반올림과 일치한다');
  assert.equal(worker.entries[0]!.indexText, '90.0');
});
test('missing OpenRouter rank never renders total tokens as a rank', () => {
  const openrouterRecords = [{ modelId: 'claude-opus-5-5', metric: 'total_tokens', value: 264308530787 }];
  const lists = computeRoleTop10(RECORDS, { openrouterRecords, effortAvailability: UNCONSTRAINED_AVAILABILITY});
  const entry = lists.orchestrator.entries.find(e => e.modelId === 'claude-opus-5-5');
  assert.equal(entry?.openrouterRankText, undefined);
});
test('a newer accessible model on another metric removes older GPT grades from the worker pool', () => {
  const records = [row('gpt-6-1-sol', INTEL, 90), row('gpt-5-6-luna', CODE, 84), row('gpt-5-6-terra', CODE, 83), row('gpt-5-6-sol', CODE, 82)];
  const lists = computeRoleTop10(records, { cognitionRecords: cog([['gpt-6-1-sol-high', 0.4], ['gpt-5-6-luna-high', 0.7],
    ['gpt-5-6-terra-high', 0.6], ['gpt-5-6-sol-high', 0.5]]), effortAvailability: UNCONSTRAINED_AVAILABILITY});
  assert.deepEqual(lists.worker.entries.map(e => e.modelId), ['gpt-6-1-sol'], 'generation rule runs on Cognition/OR evidence ids');
  assert.equal(lists.worker.entries[0]!.indexMissing, undefined, 'AA intel이 있으면 지수 열이 채워진다(p85)');
  assert.equal(lists.worker.entries[0]!.belowZone, undefined, 'a solo evidence candidate passes its own zone');
  assert.doesNotMatch(renderTop10FromRecords({ publicationDate: '2026-10-12', records }), /gpt-5-6/);
});

test('a model below the worker cutoff fills an available row; a solo candidate passes its own zone', () => {
  const lists = computeRoleTop10(RECORDS, { ...W, effortAvailability: UNCONSTRAINED_AVAILABILITY });
  assert.ok(lists.orchestrator.entries.some(e => e.modelId === 'claude-haiku-5-5'), 'O 허용: haiku도 오케 후보');
  assert.deepEqual(lists.worker.entries.map(e => [e.modelId, e.belowZone]), [['claude-opus-5-5', undefined], ['gpt-6-1-sol', undefined], ['claude-haiku-5-5', true]], 'haiku 40.0 < 최고 67.9×.60=40.7 → ▽ 보충 행; Haiku도 intel이 있어 남는다');
  const solo = computeRoleTop10([row('claude-haiku-5-5', CODE, 40, [0.8, 4])], { cognitionRecords: cog([['claude-haiku-5-5-max', 0.3]]), effortAvailability: UNCONSTRAINED_AVAILABILITY});
  assert.deepEqual(solo.worker.entries.map(e => [e.modelId, e.belowZone]), [], 'intel 없으면 워커 후보 자체가 없다(p85)');
  const soloOrch = computeRoleTop10([row('mistral-large-4', CODE, 40, [1, 1])], { cognitionRecords: cog([['mistral-large-4-max', 0.3]]), effortAvailability: UNCONSTRAINED_AVAILABILITY}).orchestrator.entries[0]!;
  assert.equal(soloOrch.indexText, '-'); assert.equal(soloOrch.indexMissing, true); // 오케 지수 결측 검증은 비밴 CODE-only 모델로
});

test('previous comparison and exits are recomputed per list with the same policy', () => {
  const cohort = cohortOf(RECORDS);
  const lists = computeRoleTop10(RECORDS, { ...W, previousCohort: cohort, effortAvailability: UNCONSTRAINED_AVAILABILITY});
  assert.ok(lists.orchestrator.entries.every(e => e.change === '유지'));
  assert.ok(lists.worker.entries.every(e => e.change === '유지'));
  assert.equal(lists.orchestrator.exits.length, 0);
  const shrunken = computeRoleTop10([row('claude-opus-5-5', INTEL, 90, [1.5, 7]), row('gpt-6-1-sol', INTEL, 88, [1.1, 4.4])],
    { previousCohort: cohort, cognitionRecords: COG.filter(r => !r.modelId.startsWith('claude-haiku')), effortAvailability: UNCONSTRAINED_AVAILABILITY});
  assert.deepEqual(shrunken.orchestrator.exits.map(x => [x.modelId, x.previousRank]), [['claude-haiku-5-5', 3]], 'O 허용: haiku 전일 3위라 shrunken에서 이탈로 잡힌다');
  assert.deepEqual(shrunken.worker.exits.map(x => x.modelId), ['claude-haiku-5-5'], 'shrunken 코호트에서 haiku가 빠지면 이탈로 잡힌다');
  assert.deepEqual([...previousRanks(RECORDS).orchestrator], [['claude-opus-5-5', 1], ['gpt-6-1-sol', 2], ['claude-haiku-5-5', 3]], 'AA만 O 허용: opus·sol·haiku 순위');
  assert.deepEqual([...previousRanks(RECORDS, W).worker], [['claude-opus-5-5', 1], ['gpt-6-1-sol', 2], ['claude-haiku-5-5', 3]], '워커 30/20/10/40·p75 상향 순서');
});

test('successor rows keep the predecessor-index lower bound in both lists', () => {
  const rows: Top10RecordInput[] = [
    { ...row('deepseek-v4.1-flash', INTEL, 69.1, [0.3, 1.2]), successorOf: 'deepseek-v4-flash' },
    { ...row('deepseek-v4.1-flash', CODE, 92, [0.3, 1.2]), successorOf: 'deepseek-v4-flash' }, // 워커 성능 1 → 하한 통과
    row('claude-opus-5-5', INTEL, 80, [1.5, 7]), row('claude-opus-5-5', CODE, 90, [1.5, 7])];
  const lists = computeRoleTop10(rows, { cognitionRecords: cog([['deepseek-v4-1-flash-max', 0.5], ['claude-opus-5-5-max', 0.55]]), effortAvailability: UNCONSTRAINED_AVAILABILITY});
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
