import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { top10OptionsFrom } from '../src/insights/letter-top10-render-options.js';
import { freeRowsFrom } from '../src/insights/letter-markdown-free-sort.js';
import { freeMarkdownRows } from '../src/insights/letter-markdown-free-table.js';
import { renderRoleTable } from '../src/insights/letter-markdown-tables.js';
import { workerCognitionSpeed, type Raw } from '../src/insights/letter-top10-score-raw.js';
import type { EffortAvailability } from '../src/insights/letter-effort-availability.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

/** #188 출력 경로 회귀: env 선택자 게이트, 이론값 vs 선택값 표기, previousRanks·compact·Free 경로, alias 표기. */
const INTEL = 'artificial_analysis_intelligence_index';
const aa = (modelId: string, value: number, price = 1): Top10RecordInput => ({ modelId, metric: INTEL, value, priceInput: price, priceOutput: price });
const catalogOf = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 'e-test', planName: 'E Test',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-19', verified: true })) }];
const av: EffortAvailability = { activeProfile: 'observed-2026-10-19', profiles: { 'observed-2026-10-19': {
  observedAt: '2026-10-19', caps: { 'muse-spark-1-3': 'xhigh' } } } };
const avAlias: EffortAvailability = { activeProfile: 't', profiles: { t: { caps: { 'muse-spark-1-3': 'xhigh' }, aliases: { spark: 'muse-spark-1-3' } } } };
const withEnv = (value: string | undefined, run: () => void): void => {
  const prev = process.env.YOROI_EFFORT_PROFILE;
  try { if (value === undefined) delete process.env.YOROI_EFFORT_PROFILE; else process.env.YOROI_EFFORT_PROFILE = value; run(); }
  finally { if (prev === undefined) delete process.env.YOROI_EFFORT_PROFILE; else process.env.YOROI_EFFORT_PROFILE = prev; }
};

test('top10OptionsFrom은 주입 없이 가용성을 만들지 않는다(기본 해석은 computeRoleTop10 env 게이트)', () => {
  assert.equal(top10OptionsFrom({}).effortAvailability, undefined);
  assert.equal(top10OptionsFrom({ effortAvailability: av }).effortAvailability, av);
});

test('compact 렌더: env 선택자로만 관측 프로필이 활성화된다', () => {
  const records = [aa('muse-spark-1-3-xhigh', 40), aa('muse-spark-1-3-max', 41), aa('claude-opus-5-5', 45)];
  withEnv(undefined, () => {
    const text = renderTop10FromRecords({ publicationDate: '2026-10-20', records });
    assert.match(text, /effort max\?/, '선택자 없으면 compact 미확인 마커를 쓴다');
    assert.doesNotMatch(text, /xhigh▲/);
  });
  withEnv('observed-2026-10-19', () => {
    const text = renderTop10FromRecords({ publicationDate: '2026-10-20', records });
    assert.match(text, /effort xhigh▲→max/, '선택자가 있을 때만 관측 cap 적용');
  });
  assert.throws(() => withEnv('no-such-profile', () => renderTop10FromRecords({ publicationDate: '2026-10-20', records })), /프로필 'no-such-profile'/);
});

test('previousRanks도 같은 프로필을 쓴다: cap 유무로 순위가 바뀐다', () => {
  const records = [aa('muse-spark-1-3-xhigh', 40), aa('muse-spark-1-3-max', 41), aa('claude-opus-5-5', 40.5)];
  withEnv('observed-2026-10-19', () => {
    const ranks = previousRanks(records), order = computeRoleTop10(records).orchestrator.entries.map(e => e.modelId);
    assert.equal(order[0], 'claude-opus-5-5', 'capped muse 40은 opus 40.5에 밀린다');
    assert.deepEqual([...ranks.orchestrator].sort((a, b) => a[1] - b[1]).map(([id]) => id), order, '전일 랭크도 같은 cap 정책');
  });
  withEnv(undefined, () => {
    assert.equal(computeRoleTop10(records).orchestrator.entries[0]!.modelId, 'muse-spark-1-3', 'cap 없으면 벤치마크 최적이 1위');
  });
});

test('Free 표도 같은 가용성 표기를 쓴다', () => {
  const records = [aa('muse-spark-1-3-xhigh', 40), aa('muse-spark-1-3-max', 41), aa('claude-sonnet-5-5-max', 45)];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['muse-spark-1-3', 'claude-sonnet-5-5']), effortAvailability: av });
  const rows = freeRowsFrom(lists, [], 15);
  const text = freeMarkdownRows(rows).join('\n');
  assert.match(text, /effort xhigh\(상한\)·벤치마크 max/, '확인된 상한은 그대로 보여준다');
  // #196: 미확인 effort 표기는 Free 화면에서 숨기되 내부 근거는 유지한다.
  assert.doesNotMatch(text, /\(미확인\)/, 'Free 화면에 미확인 effort 표기를 반복하지 않는다');
  assert.ok(rows.some(row => (row.effort ?? '').includes('(미확인)')), '내부 근거(미확인 effort)는 유지한다');
});

test('benchmarkEffort는 같은 점수 정책의 cap 없는 대표다(AA 최고 관측값이 아니다)', () => {
  // x-xhigh 41@$10 · x-high 40@$1 · x-max 40.9@$0.01: 무cap 점수 대표는 max(가성비), AA 최고 관측은 xhigh다.
  const records = [aa('x-xhigh', 41, 10), aa('x-high', 40, 1), aa('x-max', 40.9, 0.01)];
  const avX: EffortAvailability = { activeProfile: 't', profiles: { t: { caps: { x: 'xhigh' } } } };
  const e = computeRoleTop10(records, { catalog: catalogOf(['x']), effortAvailability: avX }).orchestrator.entries.find(x => x.modelId === 'x')!;
  assert.deepEqual([e.repEffort, e.effortAvailability, e.benchmarkEffort], ['xhigh', 'capped', 'max']);
});

test('alias 모델도 표기까지 같은 cap을 받는다', () => {
  const records = [aa('spark-xhigh', 40), aa('spark-max', 41)];
  const lists = computeRoleTop10(records, { catalog: catalogOf(['spark']), effortAvailability: avAlias });
  const e = lists.orchestrator.entries.find(x => x.modelId === 'spark')!;
  assert.deepEqual([e.repEffort, e.effortAvailability, e.benchmarkEffort], ['xhigh', 'capped', 'max']);
  assert.match(renderRoleTable('orchestrator', lists.orchestrator, 'H', 7), /\| spark \| xhigh\(상한\)·벤치마크 max \|/);
});

test('cap 안 관측이 없는 default 행은 상한과 벤치마크를 함께 보인다', () => {
  const lists = computeRoleTop10([aa('muse-spark-1-3-max', 41)], { catalog: catalogOf(['muse-spark-1-3']), effortAvailability: av });
  const e = lists.orchestrator.entries.find(x => x.modelId === 'muse-spark-1-3')!;
  assert.deepEqual([e.repEffort, e.effortAvailability, e.indexText, e.benchmarkEffort], ['default', 'capped', '-', 'max']);
  assert.match(renderRoleTable('orchestrator', lists.orchestrator, 'H', 7), /\| muse-spark-1-3 \| default\(상한\)·벤치마크 max \|/);
});

test('워커 Cog 속도 fallback은 선택 effort 값을 풀에 넣어 0..1을 벗어나지 않는다', () => {
  // a의 대표 effort가 default(cogDurE 변형 목록 밖)여도 queried 값이 풀에 들어가 표준화가 0..1에 머문다.
  const a: Raw = { cogDurE: new Map([['xhigh', 5], ['default', 100]]), aaEffort: new Map([['default', 45], ['xhigh', 40]]) };
  const b: Raw = { cogDurE: new Map([['xhigh', 10]]), aaEffort: new Map([['xhigh', 39]]) };
  const speeds = workerCognitionSpeed([a, b], ['default', 'xhigh'], ['xhigh', 'xhigh']);
  assert.deepEqual(speeds.map(v => v !== undefined && v >= 0 && v <= 1), [true, true], `0..1 벗어남: ${speeds}`);
  assert.deepEqual([speeds[0], speeds[1]], [0, 0.9473684210526315], '구 풀(5..10)이면 a(100)가 -18로 폭주했다');
});
