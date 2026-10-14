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
  assert.ok(section.includes('| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | 성능/사용량/속도/가성비 | Free 경로 |'));
  assert.ok(section.includes('| 순위 | 파레토 | 모델 | 추천 effort | 스코어 | 성능/사용량/속도/가격 | Free 경로 |'));
  assert.ok(section.includes('| 1 | 👍 | step-5 | default | 70.0 | 100/-/-/0 | OpenCode Zen Free'));
  assert.ok(section.includes('| 1 | 👍 | big-pickle | default | 70.0 | 100/-/-/100 | OpenCode Zen Free'));
  assert.ok(section.includes('| 1 | 👍 | step-5 |'), 'free orchestrator leader: 👍 in the pareto column, no ↔');
  assert.ok(!section.includes('↔') && !section.includes('⭐'));
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
  assert.ok(!md.includes('## 접근 요금제') && !md.includes('☑') && !md.includes('☐'), 'access checklist table removed');
  assert.ok(md.includes('- off-peak·파레토, score 원 API') && !md.includes('Free 경로 가격 0'));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: RECORDS });
  assert.ok(!text.includes('선행') && !text.includes('(크레딧'));
});

const STAR_RECORDS = [
  { modelId: 'step-5', value: 43.7, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'big-pickle', value: 30, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-0-flash-fin', value: 22.6, metric: INTEL, priceInput: 0, priceOutput: 0 },
  { modelId: 'mimo-v2-5', value: 70, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 }];
// p52: Free 표도 역할별 가중치. Free 경로는 접근 근거일 뿐 가격을 바꾸지 않는다(관측 단가 0은 실제 0).
const STAR_COGNITION = [{ modelId: 'mimo-v2-5', value: 0.7, metric: 'cognition_correct' },
  { modelId: 'ling-3-0-flash-fin', value: 0.6, metric: 'cognition_correct' }];

test('free pareto marks only score-undominated rows; dominated rows carry no mark', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: STAR_RECORDS, cognitionRecords: STAR_COGNITION, freeCatalog: FREE_CATALOG });
  const section = md.slice(md.indexOf('## 🆓 Free 티어'), md.indexOf('## 📖'));
  const orch = section.slice(section.indexOf('### 오케스트레이터'), section.indexOf('### 워커'));
  const worker = section.slice(section.indexOf('### 워커'));
  // p70: 성능 70%·사용량 5%·속도 10%·가성비 15%; Free access adds no price anchor.
  for (const row of ['| 1 | 👍 | step-5 |', '| ▽ 2 |  | mimo-v2-5 |', '| ▽ 3 |  | big-pickle |', '| ▽ 4 |  | ling-3-0-flash-fin |']) assert.ok(orch.includes(row), row);
  assert.ok(worker.includes('| 1 | 👍 | mimo-v2-5 |'), 'only Mimo meets the worker performance floor');
  assert.ok(!worker.includes('big-pickle') && !worker.includes('ling-3-0-flash-fin') && !worker.includes('step-5'));
});

test('a verified Free path alone is access evidence, not orchestration price evidence; no placeholder rows', () => {
  const sparse = [{ modelId: 'step-5', value: 43.7, metric: INTEL, priceInput: 0, priceOutput: 0 },
    { modelId: 'ling-3-0-flash-fin', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 }];
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: sparse, freeCatalog: FREE_CATALOG });
  for (const id of ['big-pickle', 'mimo-v2-5']) {
    assert.ok(md.includes(`| ${id} | default | 0.0 | -/-/-/- | OpenCode Zen Free |`), `orchestrator: ${id}`);
  }
  assert.ok(!md.includes('| 근거 없음 |') && !md.includes('- AA 미측정(순위 제외)'));
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: sparse, freeCatalog: FREE_CATALOG });
  assert.ok(!text.includes('· 근거 없음 ·') && text.includes('mimo-v2-5 · effort default · 스코어 0.0 · -/-/-/- · 단가 -'), text);
});
