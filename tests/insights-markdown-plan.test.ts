import assert from 'node:assert/strict';
import test from 'node:test';
import { renderPlanOptimalMarkdown } from '../src/insights/letter-markdown-plan.js';
import { renderTop10Markdown, renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { EXCLUSION_NOTE } from '../src/insights/top10-policy.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const rec = (modelId: string, metric: string, value: number): Top10RecordInput =>
  ({ modelId, metric, value, priceInput: 1.1, priceOutput: 4.4 });

const PLAN_RECORDS: readonly Top10RecordInput[] = [
  rec('claude-opus-5-5', 'artificial_analysis_intelligence_index', 90),
  rec('claude-sonnet-5-5', 'artificial_analysis_intelligence_index', 80),
  rec('gpt-6-1-sol', 'artificial_analysis_intelligence_index', 88),
  rec('gemini-3-8-flash', 'artificial_analysis_intelligence_index', 99),
  rec('claude-opus-5-5', 'artificial_analysis_coding_index', 70),
  rec('gpt-6-1-sol', 'artificial_analysis_coding_index', 72),
];

test('plan-optimal markdown table lists plan, role, 1~3 places and indices', () => {
  const lines = renderPlanOptimalMarkdown(PLAN_RECORDS).join('\n');
  assert.ok(lines.includes('## 💳 요금제상 최적'));
  assert.ok(lines.includes('| 요금제 | 관점 | 1~3위 모델 | 지수 |'));
  assert.ok(lines.includes('| --- | --- | --- | --- |'));
  assert.ok(lines.includes('| Claude Pro | 오케스트레이터 | 1위 Claude Opus 5.5'));
  assert.ok(lines.includes('| ChatGPT Plus | 오케스트레이터 | 1위 GPT-6.1 Sol'));
  assert.ok(lines.includes('| Claude Pro | 워커 | 1위 Claude Opus 5.5'));
  assert.ok(lines.includes('90.0') && lines.includes('70.0'));
  assert.ok(!lines.includes('gemini-3-8-flash') && !lines.includes('Gemini 3.8'));
  assert.ok(lines.trimEnd().endsWith('정액제는 추가 비용이 없어 지수 순'));
});

test('models missing from the verified catalog omit the section entirely', () => {
  assert.deepEqual(renderPlanOptimalMarkdown([]), []);
  assert.deepEqual(renderPlanOptimalMarkdown([rec('gemini-3-8-flash', 'artificial_analysis_intelligence_index', 95)]), []);
});

test('markdown letter embeds the plan section and the shared exclusion note', () => {
  const md = renderTop10MarkdownFromRecords({ publicationDate: '2026-10-12', records: PLAN_RECORDS });
  assert.ok(md.includes('## 💳 요금제상 최적'));
  assert.ok(md.includes('| 요금제 | 관점 | 1~3위 모델 | 지수 |'));
  assert.ok(md.includes('정액제는 추가 비용이 없어 지수 순'));
  assert.ok(md.includes(`- ${EXCLUSION_NOTE}`));
  assert.ok(!md.includes('off-peak 확인분 적용'));
  const bare = renderTop10Markdown({ publicationDate: '2026-10-12',
    lists: { orchestrator: { entries: [], exits: [] }, worker: { entries: [], exits: [] } } });
  assert.ok(!bare.includes('💳'));
});

test('compact render and markdown share the same exclusion note', () => {
  const compact = renderTop10FromRecords({ publicationDate: '2026-10-12', records: PLAN_RECORDS });
  assert.ok(compact.includes(EXCLUSION_NOTE));
});
