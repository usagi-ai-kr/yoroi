import assert from 'node:assert/strict';
import test from 'node:test';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { freeOnlyModelIds } from '../src/insights/letter-top10-plans.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const RECORDS = [
  { modelId: 'step-5', value: 90, metric: INTEL, priceInput: 1, priceOutput: 2 },
  { modelId: 'claude-opus-5-5', value: 80, metric: INTEL, priceInput: 3, priceOutput: 15 },
  { modelId: 'gemini-3-8-flash', value: 70, metric: CODE, priceInput: 1, priceOutput: 4 },
  { modelId: 'big-pickle', value: 60, metric: CODE, priceInput: 0, priceOutput: 0 },
];

test('free-only models leave the paid list and move into the Free section', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: RECORDS });
  const orch = md.slice(md.indexOf('## 🧭'), md.indexOf('## 🛠️'));
  assert.ok(!orch.includes('| step-5 |'), 'step-5 must not sit in the paid orchestrator table');
  assert.ok(md.includes('## 🆓 Free 티어'));
  assert.ok(md.includes('| 1 | step-5 |'), 'step-5 leads the free orchestrator list');
  assert.ok(md.includes('OpenCode Zen Free+OpenCode Go Free ⚠️세션 헤더 필요'));
  assert.ok(md.includes('- Antigravity Free: 주간 쿼터 갱신·주간 rate limit(수치 비공개).'));
  assert.ok(md.includes('- 미확인: ChatGPT Free(공식 페이지 403)'));
  assert.ok(md.includes('- Free 섹션: 비용 항목 동일(무료)이라 지수·사용량·속도로 사실상 정렬'));
  assert.ok(md.includes('🆓 무료(🆓 Free 티어 섹션 표시)'), 'legend ties the 🆓 mark to the section');
});

test('the compact letter carries the Free section with both roles and the tier notes', () => {
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: RECORDS });
  assert.ok(text.includes('## 🆓 Free 티어'));
  assert.ok(text.includes('1. step-5 · effort'), 'free orchestrator row');
  assert.ok(text.includes('2. gemini-3-8-flash · effort'), 'free worker row (big-pickle outscored it)');
  assert.ok(text.includes('- OpenCode Go Free: Unlimited·기간 한정, x-opencode-session 헤더 필수로 OpenCode 클라이언트 세션에서만 사용.'));
  assert.ok(!text.slice(0, text.indexOf('## 🆓 Free 티어')).includes('step-5'), 'no free-only model before the section');
});

test('freeOnlyModelIds keeps free-reachable models and drops paid-accessible free models', () => {
  const ids = freeOnlyModelIds();
  assert.ok(ids.includes('step-5') && ids.includes('big-pickle') && ids.includes('longcat-2-5-preview-free'));
  assert.ok(!ids.includes('gemini-3-8-flash'), 'also on the paid Antigravity plan');
  assert.ok(!ids.includes('muse-spark-1-3'), 'also on the paid OpenCode Go plan');
  assert.ok(!ids.includes('nemotron-3-ultra'), 'also on the paid Ollama plan');
});

const FILL_RECORDS = [
  { modelId: 'gemini-3-8-flash', value: 90, metric: CODE, priceInput: 1, priceOutput: 4 },
  { modelId: 'big-pickle', value: 50, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'exo', value: 49, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'jev-1-13', value: 48, metric: CODE, priceInput: 0, priceOutput: 0 },
  { modelId: 'ling-3-1-flash', value: 47, metric: CODE, priceInput: 0, priceOutput: 0 }];

test('each free role renders its own table right under its subheading', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: FILL_RECORDS });
  const section = md.slice(md.indexOf('## 🆓 Free 티어'), md.indexOf('## 📖'));
  for (const label of ['### 오케스트레이터', '### 워커']) {
    const at = section.indexOf(label);
    assert.ok(at >= 0, label);
    const after = section.slice(at + label.length).replace(/^\s+/, '');
    assert.ok(after.startsWith('| 순위 | 모델 | 추천 effort | 스코어 | 지수 | Free 경로 |'), after.slice(0, 60));
    assert.ok(after.startsWith('| 순위 | 모델 | 추천 effort | 스코어 | 지수 | Free 경로 |\n| --- | --- | --- | --- | --- | --- |'));
  }
  assert.ok(!section.includes('### 오케스트레이터\n| 1 |'), 'no heading glued to a row');
});

test('below-zone free rows carry the ▽ rank marker in both formats', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-13', records: FILL_RECORDS });
  const section = md.slice(md.indexOf('## 🆓 Free 티어'), md.indexOf('## 📖'));
  assert.match(section, /\| ▽ \d+ \| big-pickle \|/, section);
  const text = renderTop10FromRecords({ publicationDate: '2026-10-13', records: FILL_RECORDS });
  assert.match(text.slice(text.indexOf('## 🆓 Free 티어')), /▽ \d+\. big-pickle/);
});
