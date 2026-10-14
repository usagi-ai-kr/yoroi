import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';
import { calcBlendedCost } from '../src/insights/letter-top10-group.js';

const NOW = '2026-10-12T00:00:00Z';
/** AA 합성 fixture: GLM-5.3 Flash 코딩 지수 76.2·인텔리전스 71.5, 입력 $3·출력 $15 → 혼합 단가 (3×3+15)/4 = $6.00/1M. */
const aaData = { tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 1, total_pages: 1, has_more: false },
  data: [{ id: 'glm-5-3-flash', slug: 'glm-5-3-flash', name: 'GLM-5.3 Flash', release_date: null,
    model_creator: { id: 'zai', name: 'Z.ai' },
    evaluations: { artificial_analysis_coding_index: 76.2, artificial_analysis_intelligence_index: 71.5 },
    pricing: { price_1m_input_tokens: 3, price_1m_output_tokens: 15 }, performance: {} }] };

test('AA blended cost (input $3 / output $15) stays $6.00/1M in storage and the model remains in the letter', async () => {
  const run = await runInsightsOnce({ ports: [{ id: 'artificial-analysis', fetch: async () => aaData, parse: parseAaResponse }],
    history: new MemoryInsightHistory(), now: () => NOW });
  const top10 = run.top10!;
  const row = top10.records.find(r => r.modelId === 'glm-5-3-flash' && r.metric === 'artificial_analysis_coding_index')!;
  assert.deepEqual([row.priceInput, row.priceOutput], [3, 15]);
  assert.equal(calcBlendedCost(row.priceInput, row.priceOutput), 6);
  const compact = renderTop10FromRecords({ publicationDate: run.publicationDate, ...top10 });
  assert.match(compact, / glm-5-3-flash(?: ↔)? · effort/);
  const md = renderTop10MarkdownFromRecords({ publicationDate: run.publicationDate, ...top10 });
  assert.match(md, /\| glm-5-3-flash(?: ↔)? \|/);
});
test('a one-sided or missing AA price never invents a blended cost', async () => {
  const oneSided = { ...aaData, data: [{ ...aaData.data[0]!, pricing: { price_1m_input_tokens: 3 } }] };
  const run = await runInsightsOnce({ ports: [{ id: 'artificial-analysis', fetch: async () => oneSided, parse: parseAaResponse }],
    history: new MemoryInsightHistory(), now: () => NOW });
  const row = run.top10!.records.find(r => r.modelId === 'glm-5-3-flash')!;
  assert.equal(row.priceInput, 3);
  assert.equal(row.priceOutput, undefined);
  const compact = renderTop10FromRecords({ publicationDate: run.publicationDate, ...run.top10! });
  assert.match(compact, /glm-5-3-flash[^\n]*단가 -/);
  assert.doesNotMatch(compact, /· 단가 \$[\d.]+\/1M/);
});
