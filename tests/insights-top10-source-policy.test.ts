import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { ROLE_DIMENSION_WEIGHTS, ROLE_SOURCES, SCORE_DIMENSIONS, WORKER_PERFORMANCE_FLOOR } from '../src/insights/letter-top10-score.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import type { OffPeakRate } from '../src/insights/model-price-overrides.js';

/** p54 C: 원 API 가격·역할별 가중치·워커 성능 하한. p75: 오케 82/6/12(가성비 제거). */
const INTEL = 'artificial_analysis_intelligence_index', CODING = 'artificial_analysis_coding_index', SPEED = 'median_output_tokens_per_second';
const COG = 'cognition_correct';
const entry = (modelId: string) => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-14', verified: true });
const PAID: PlanCatalogEntry = { planId: 'paid', planName: 'Paid', models: ['m-paid', 'm-both', 'm-fast'].map(entry) };
const FREE: PlanCatalogEntry = { planId: 'free', planName: 'Free Zen', tier: 'free', models: ['m-free', 'm-both'].map(entry) };
const same = (ids: readonly string[], price: (id: string) => number) => ids.map(modelId => ({ modelId, metric: INTEL, value: 50, priceInput: price(modelId), priceOutput: price(modelId) }));
const orch = (opts: Parameters<typeof computeRoleTop10>[1], records: Parameters<typeof computeRoleTop10>[0]) => computeRoleTop10(records, opts).orchestrator.entries;

test('role weights are exported, sum to 1 per role, and differ by role', () => {
  for (const w of Object.values(ROLE_DIMENSION_WEIGHTS)) assert.equal(Math.round(SCORE_DIMENSIONS.reduce((s, d) => s + (w[d] ?? 0), 0) * 1e9), 1e9);
  assert.deepEqual(ROLE_DIMENSION_WEIGHTS, { orchestrator: { performance: 0.82, usage: 0.06, speed: 0.12 },
    worker: { performance: 0.3, usage: 0.2, speed: 0.1, price: 0.4 } });
  assert.equal(WORKER_PERFORMANCE_FLOOR, 0.7);
  assert.deepEqual([ROLE_SOURCES.orchestrator.usage, ROLE_SOURCES.orchestrator.speed, ROLE_SOURCES.orchestrator.price,
    ROLE_SOURCES.worker.speed, ROLE_SOURCES.worker.price], [['openrouter', 'opencode'], ['aa', 'cognition'], [], ['aa'], ['aa']]);
});

test('a Free route keeps the original API price: no 0 anchor, no forced price 100, off-peak still applies', () => {
  const e = orch({ catalog: [PAID], freeCatalog: [FREE] }, same(['m-paid', 'm-free'], id => id === 'm-free' ? 4 : 2));
  assert.deepEqual(e.map(x => [x.modelId, x.scoreText, x.blendedCostText]).slice(0, 2), [['m-free', '82.0', '$4.00/1M'], ['m-paid', '82.0', '$2.00/1M']]);
  assert.equal(e[1]!.scoreComponents?.sources?.['price:free'], undefined, '가격이 달라도 같은 성능이면 같은 스코어(가성비 없음)');
  const overrides: Record<string, OffPeakRate> = { 'm-both': { provider: 'deepseek-platform', input: 0.5, output: 0.5, sourceUrl: 'https://example.test', checkedOn: '2026-10-14' } };
  const both = orch({ catalog: [PAID], freeCatalog: [FREE], priceOverrides: overrides, nowUtc: '2026-10-13T18:00:00Z' }, same(['m-both'], () => 2))[0]!;
  assert.deepEqual([both.modelId, both.offPeak, both.blendedCostText, both.scoreComponents?.dimensionSources?.price], ['m-both', true, '$0.50/1M', undefined]);
});

test('orchestrator shows prices but has no price dimension: observed $0 and missing price both leave cost at 0 (p75)', () => {
  const e = orch({ catalog: [PAID], freeCatalog: [FREE] }, [...same(['m-paid'], () => 0), { modelId: 'm-free', metric: INTEL, value: 50 }]);
  const free = e.find(x => x.modelId === 'm-free')!, paid = e.find(x => x.modelId === 'm-paid')!;
  assert.deepEqual([paid.scoreComponents?.cost, paid.blendedCostText], [0, '무료'], 'observed $0 is shown, not scored');
  assert.deepEqual([free.scoreComponents?.cost, free.scoreComponents?.sources?.['price:missing'], free.scoreComponents?.dimensionSources?.price, free.blendedCostText],
    [0, undefined, undefined, '단가 -']);
  const none = orch({ catalog: [PAID] }, [{ modelId: 'm-paid', metric: INTEL, value: 50 }])[0]!;
  assert.deepEqual([none.scoreComponents?.cost, none.scoreComponents?.dimensionSources?.price, none.scoreText], [0, undefined, '82.0'], 'no price evidence → still full performance score');
});

test('each dimension takes the higher source value; missing performance/usage/speed score 0 without reweighting', () => {
  const lists = computeRoleTop10([{ modelId: 'm-paid', metric: INTEL, value: 10 }, { modelId: 'm-both', metric: INTEL, value: 90 }],
    { catalog: [PAID], cognitionRecords: [{ modelId: 'm-paid-max', metric: COG, value: 0.9 }, { modelId: 'm-both-low', metric: COG, value: 0.1 }] });
  assert.deepEqual(lists.orchestrator.entries.map(e => [e.modelId, e.scoreText, e.repEffort]), [['m-both', '82.0', 'low'], ['m-paid', '82.0', 'max']]);
});

test('role weights differentiate the two lists without forcing exclusion: a model may lead both or only one', () => {
  const records = [{ modelId: 'm-paid', metric: INTEL, value: 90 }, { modelId: 'm-paid', metric: CODING, value: 90 }, { modelId: 'm-paid', metric: SPEED, value: 10 },
    { modelId: 'm-fast', metric: INTEL, value: 60 }, { modelId: 'm-fast', metric: CODING, value: 60 }, { modelId: 'm-fast', metric: SPEED, value: 200 },
    { modelId: 'm-both', metric: CODING, value: 50 }];
  const cognitionRecords = [{ modelId: 'm-paid-high', metric: COG, value: 0.9 }, { modelId: 'm-fast-high', metric: COG, value: 0.8 }, { modelId: 'm-both-high', metric: COG, value: 0.1 }];
  const lists = computeRoleTop10(records, { catalog: [PAID], cognitionRecords });
  assert.deepEqual(lists.orchestrator.entries.map(e => [e.modelId, e.scoreText]), [['m-fast', '83.7'], ['m-paid', '82.0'], ['m-both', '0.0']]);
  assert.deepEqual(lists.worker.entries.map(e => [e.modelId, e.scoreText, e.both]), [['m-fast', '36.3', true], ['m-paid', '30.0', true]]);
  assert.ok(!lists.worker.entries.some(e => e.modelId === 'm-both'), 'performance below .70 is removed before zone fill');
});

test('render shows original prices, the 99 missing-price cell, and role weights in the formula', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-14', records: same(['m-paid'], () => 2), catalog: [PAID], freeCatalog: [FREE] } as never);
  const o = md.slice(md.indexOf('## 🧭'), md.indexOf('## 🛠️'));
  assert.ok(o.includes('| 1 | 👍 | m-paid | default | 82.0 | 100/-/- |') && o.includes('| m-free | default | 0.0 | -/-/- |') && !md.includes('무료(Free 경로)'), o);
  assert.ok(md.includes('- 가중치: 오케·리뷰어 성능 82%·사용량 6%·속도 12% / 워커·메신저 성능 30%·사용량 20%·속도 10%·가격 40%'));
  assert.ok(md.includes('워커 성능<0.7·결측 제외'));
});
