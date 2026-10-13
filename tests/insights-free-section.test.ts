import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const freeEntry = (modelId: string, displayName = modelId) =>
  ({ modelId, displayName, sourceUrl: 'https://opencode.ai/v2/docs/console/models', checkedOn: '2026-10-13', verified: true });
const FREE_CATALOG: readonly PlanCatalogEntry[] = [
  { planId: 'opencode-zen-free', planName: 'OpenCode Zen Free', tier: 'free',
    models: [freeEntry('big-pickle', 'Big Pickle'), freeEntry('step-5', 'Step 5 Preview Free'), freeEntry('mimo-v2-5'), freeEntry('ling-3-0-flash-fin')] },
  { planId: 'opencode-go-free', planName: 'OpenCode Go Free', tier: 'free', models: [freeEntry('step-5', 'Step 5 Preview Free')] },
];
const RECORDS = [
  { modelId: 'step-5', value: 90, metric: INTEL, priceInput: 1, priceOutput: 2 },
  { modelId: 'big-pickle', value: 80, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 85, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'mimo-v2-5', value: 70, metric: CODE, priceInput: 0.1, priceOutput: 0.4 },
  { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'claude-sonnet-5-5', value: 88, metric: INTEL, priceInput: 1, priceOutput: 5 }];

test('the free section renders from the injected freeCatalog with notes limited to Zen/Go Free', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: RECORDS, freeCatalog: FREE_CATALOG });
  const section = md.slice(md.indexOf('## 🆓 Free 티어'), md.indexOf('## 📖'));
  assert.ok(section.includes('### 오케스트레이터') && section.includes('### 워커'));
  assert.ok(section.includes('⭐ 1 | step-5 ↔ |'), 'free orchestrator leader with star and dual-list mark');
  assert.ok(section.includes('⭐ '), 'pareto star inside the free table');
  assert.ok(section.includes('OpenCode Go Free ⚠️세션 헤더 필요'), 'Go Free session-header caveat kept');
  assert.ok(section.includes('OpenCode Zen Free+OpenCode Go Free ⚠️세션 헤더 필요'));
  assert.ok(section.includes('- OpenCode Zen Free: 기간 한정 무료'));
  assert.ok(section.includes('- OpenCode Go Free: Unlimited·기간 한정'));
  assert.ok(!section.includes('Antigravity Free') && !section.includes('미확인'), 'Antigravity/unknown lines removed');
});

test('an absent freeCatalog yields the single collection-failure line', () => {
  for (const empty of [undefined, [] as readonly PlanCatalogEntry[]]) {
    const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: RECORDS, ...(empty && { freeCatalog: empty }) });
    const section = md.slice(md.indexOf('## 🆓 Free 티어'), md.indexOf('## 📖'));
    assert.ok(section.includes('Free 목록 수집 실패(opencode models)'));
    assert.ok(!section.includes('### 오케스트레이터'));
    const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: RECORDS });
    assert.ok(text.includes('Free 목록 수집 실패(opencode models)'));
  }
});

test('labels are plain: no successor note, no bracketed plan tails, no Cursor for third-party', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: RECORDS, freeCatalog: FREE_CATALOG });
  assert.ok(!md.includes('선행'), 'successor annotation removed');
  assert.ok(!md.includes('(크레딧'), 'credit tail removed');
  assert.ok(!md.includes('440회'), 'limit tail removed');
  assert.ok(!md.includes('API 정가'), 'cursor billing label removed');
  const access = md.slice(md.indexOf('## 접근 요금제'), md.indexOf('## 🆓 Free 티어'));
  const sonnet = access.split('\n').find(l => l.startsWith('| claude-sonnet-5-5'))!;
  assert.ok(sonnet.includes('☑'), sonnet);
  assert.ok(!access.includes('Cursor'), 'Cursor는 자체 모델만 접근 경로');
  assert.ok(md.includes('- off-peak: 실행 시각 기준 확인된 할인 단가 적용'));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: RECORDS });
  assert.ok(!text.includes('선행') && !text.includes('(크레딧'));
});

const STAR_RECORDS = [
  { modelId: 'step-5', value: 43.7, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 30, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-0-flash-fin', value: 22.6, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'mimo-v2-5', value: 70, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 }];

test('free pareto stars only index-undominated rows; dominated rows carry no star', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: STAR_RECORDS, freeCatalog: FREE_CATALOG });
  const section = md.slice(md.indexOf('## 🆓 Free 티어'), md.indexOf('## 📖'));
  const orch = section.slice(section.indexOf('### 오케스트레이터'), section.indexOf('### 워커'));
  const worker = section.slice(section.indexOf('### 워커'));
  assert.match(orch, /\| ⭐ 1 \| step-5 ↔ \|/, orch);
  assert.ok(orch.includes('| ▽ 2 | big-pickle ↔ |'), 'dominated by step-5: no star');
  assert.ok(orch.includes('| ▽ 3 | ling-3-0-flash-fin ↔ |'), 'dominated: no star');
  assert.match(worker, /\| ⭐ 1 \| mimo-v2-5 ↔ \|/);
  assert.ok(worker.includes('| 2 | ling-3-0-flash-fin ↔ |'), 'dominated: no star');
});

test('free models without AA records are listed as unmeasured at the section bottom', () => {
  const sparse = [{ modelId: 'step-5', value: 43.7, metric: INTEL, priceInput: 0, priceOutput: 0 },
    { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 }];
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: sparse, freeCatalog: FREE_CATALOG });
  assert.ok(md.includes('- AA 미측정(순위 제외): big-pickle, mimo-v2-5'));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: sparse, freeCatalog: FREE_CATALOG });
  assert.ok(text.includes('- AA 미측정(순위 제외): big-pickle, mimo-v2-5'));
});
