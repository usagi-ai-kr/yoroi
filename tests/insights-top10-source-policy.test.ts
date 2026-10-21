import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, SCORE_DIMENSIONS, WORKER_PERFORMANCE_FLOOR } from '../src/insights/letter-top10-score.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import type { OffPeakRate } from '../src/insights/model-price-overrides.js';
import { UNCONSTRAINED_AVAILABILITY } from '../src/insights/letter-effort-availability.js';

/** C: 원 API 가격·역할별 가중치·워커 성능 하한. R(1.2.1): 오케 75/0/10/15. */
const INTEL = 'artificial_analysis_intelligence_index', CODING = 'artificial_analysis_coding_index', SPEED = 'median_output_tokens_per_second';
const COG = 'cognition_correct';
const entry = (modelId: string) => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true });
const PAID: PlanCatalogEntry = { planId: 'paid', planName: 'Paid', models: ['m-paid', 'm-both', 'm-fast'].map(entry) };
const FREE: PlanCatalogEntry = { planId: 'free', planName: 'Free Zen', tier: 'free', models: ['m-free', 'm-both'].map(entry) };
const same = (ids: readonly string[], price: (id: string) => number) => ids.map(modelId => ({ modelId, metric: INTEL, value: 50, priceInput: price(modelId), priceOutput: price(modelId) }));
const orch = (opts: Parameters<typeof computeRoleTop10>[1], records: Parameters<typeof computeRoleTop10>[0]) => computeRoleTop10(records, { ...opts, effortAvailability: UNCONSTRAINED_AVAILABILITY }).orchestrator.entries;

test('role weights are exported, sum to 1 per role, and differ by role', () => {
  for (const w of Object.values(ROLE_DIMENSION_WEIGHTS)) assert.equal(Math.round(SCORE_DIMENSIONS.reduce((s, d) => s + (w[d] ?? 0), 0) * 1e9), 1e9);
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, { orchestrator: { performance: 0.75, usage: 0, speed: 0.10, price: 0.15 },
    worker: { performance: 0.30, usage: 0.20, speed: 0.10, price: 0.40 } });
  assert.equal(WORKER_PERFORMANCE_FLOOR, 0.7);
  assert.deepEqual([ROLE_SOURCES.orchestrator.usage, ROLE_SOURCES.orchestrator.speed, ROLE_SOURCES.orchestrator.price,
    ROLE_SOURCES.worker.speed, ROLE_SOURCES.worker.price], [['openrouter', 'opencode'], ['aa', 'cognition'], ['aa', 'cognition'], ['aa'], ['aa']]);
});

test('a Free route keeps the original API price: no 0 anchor, no forced price 100, off-peak still applies', () => {
  const e = orch({ catalog: [PAID], freeCatalog: [FREE] }, same(['m-paid', 'm-free'], id => id === 'm-free' ? 4 : 2));
  assert.deepEqual(e.map(x => [x.modelId, x.rawScore?.toFixed(1), x.blendedCostText]).slice(0, 2), [['m-paid', '90.0', '$2.00/1M'], ['m-free', '75.0', '$4.00/1M']]); // raw
  assert.equal(e[1]!.scoreComponents?.sources?.['price:free'], undefined, '같은 성능이면 싼 단가가 가성비 1로 이긴다(R: 90.0 vs 75.0)');
  const overrides: Record<string, OffPeakRate> = { 'm-both': { provider: 'deepseek-platform', input: 0.5, output: 0.5, sourceUrl: 'https://example.test', checkedOn: '2026-10-14' } };
  const both = orch({ catalog: [PAID], freeCatalog: [FREE], priceOverrides: overrides, nowUtc: '2026-10-13T18:00:00Z' }, same(['m-both'], () => 2))[0]!;
  assert.deepEqual([both.modelId, both.offPeak, both.blendedCostText, both.scoreComponents?.dimensionSources?.price], ['m-both', true, '$0.50/1M', 'aa'], 'R: 단가 근거가 있으면 cost 원천 aa');
});

test('orchestrator prices move the cost component via linear value: observed $0 wins, missing stays 0 (R)', () => {
  const e = orch({ catalog: [PAID], freeCatalog: [FREE] }, [...same(['m-paid'], () => 0), { modelId: 'm-free', metric: INTEL, value: 50 }]);
  const free = e.find(x => x.modelId === 'm-free')!, paid = e.find(x => x.modelId === 'm-paid')!;
  assert.deepEqual([paid.scoreComponents?.cost, paid.blendedCostText], [1, '무료'], '관측 $0은 최대 가성비로 점수에 반영된다');
  assert.deepEqual([free.scoreComponents?.cost, free.scoreComponents?.sources?.['price:missing'], free.scoreComponents?.dimensionSources?.price, free.blendedCostText],
    [0, undefined, undefined, '단가 -']);
  const none = orch({ catalog: [PAID] }, [{ modelId: 'm-paid', metric: INTEL, value: 50 }])[0]!;
  assert.deepEqual([none.scoreComponents?.cost, none.scoreComponents?.dimensionSources?.price, none.rawScore?.toFixed(1)], [0, undefined, '75.0'], '가격 근거 없으면 성능 75점(raw)');
});

test('each dimension takes the higher source value; missing performance/usage/speed score 0 without reweighting', () => {
  const lists = computeRoleTop10([{ modelId: 'm-paid', metric: INTEL, value: 10 }, { modelId: 'm-both', metric: INTEL, value: 90 }],
    { catalog: [PAID], cognitionRecords: [{ modelId: 'm-paid-max', metric: COG, value: 0.9 }, { modelId: 'm-both-low', metric: COG, value: 0.1 }], effortAvailability: UNCONSTRAINED_AVAILABILITY});
  assert.deepEqual(lists.orchestrator.entries.map(e => [e.modelId, e.rawScore?.toFixed(1), e.repEffort]), [['m-both', '75.0', 'low'], ['m-paid', '75.0', 'max']]);
});

test('role weights differentiate the two lists without forcing exclusion: a model may lead both or only one', () => {
  const records = [{ modelId: 'm-paid', metric: INTEL, value: 90 }, { modelId: 'm-paid', metric: CODING, value: 90 }, { modelId: 'm-paid', metric: SPEED, value: 10 },
    { modelId: 'm-fast', metric: INTEL, value: 60 }, { modelId: 'm-fast', metric: CODING, value: 60 }, { modelId: 'm-fast', metric: SPEED, value: 200 },
    { modelId: 'm-both', metric: CODING, value: 50 }];
  const cognitionRecords = [{ modelId: 'm-paid-high', metric: COG, value: 0.9 }, { modelId: 'm-fast-high', metric: COG, value: 0.8 }, { modelId: 'm-both-high', metric: COG, value: 0.1 }];
  const lists = computeRoleTop10(records, { catalog: [PAID], cognitionRecords, effortAvailability: UNCONSTRAINED_AVAILABILITY});
  assert.deepEqual(lists.orchestrator.entries.map(e => [e.modelId, e.rawScore?.toFixed(1)]), [['m-fast', '75.6'], ['m-paid', '75.0'], ['m-both', '0.0']]);
  // 워커(사용자 확정 30/20/10/40): 성능은 AA intel만(m-paid 1·m-fast 0), Cog correct는 가산으로만 들어간다(m-paid 5.0·m-fast 4.4). m-both는 intel이 없어 제외된다.
  assert.deepEqual(lists.worker.entries.map(e => [e.modelId, e.rawScore?.toFixed(1), e.both]), [['m-paid', '35.0', true], ['m-fast', '14.4', true]]);
  assert.ok(!lists.worker.entries.some(e => e.modelId === 'm-both'), 'intel 없으면 후보에서 제외된다');
});

test('render shows original prices, the 99 missing-price cell, and role weights in the formula', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-14', records: same(['m-paid'], () => 2), catalog: [PAID], freeCatalog: [FREE] } as never);
  const o = md.slice(md.indexOf('## 🧭'), md.indexOf('## 🛠️'));
  // 표시 점수는 모집단(3) 정규 순위: m-paid 59.67, m-both/m-free 45.69. raw는 90/0/75.
  assert.ok(o.includes('| 1 | m-paid | default | 59.67 | 100/-/100 |') && o.includes('| ▽ 3 | m-free | default | 45.69 | -/-/- |') && !md.includes('무료(Free 경로)'), o);
  assert.ok(!o.includes('(미확인)') && !o.includes('(상한)'), 'effort 칸은 plain(미확인·상한 표기 없음)');
  assert.ok(md.includes('- 가중치: 오케·리뷰어 성능 75%·속도 10%·가성비 15% / 워커 성능 30%·사용량 20%·속도 10%·가격 40%'));
  assert.ok(md.includes('워커 intel<33·결측 제외'));
});
