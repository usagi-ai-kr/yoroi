import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { renderTop10FromRecords } from '../src/insights/letter-top10-render.js';
import { renderTop10MarkdownFromRecords } from '../src/insights/letter-markdown.js';

const NOW = '2026-10-12T00:00:00Z';
/** AA 합성 fixture: Kimi K3 코딩 지수 76.2, 입력 $3·출력 $15 → 혼합 단가 (3×3+15)/4 = $6.00/1M. */
const aaData = { tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 1, total_pages: 1, has_more: false },
  data: [{ id: 'kimi-k3', slug: 'kimi-k3', name: 'Kimi K3', release_date: null,
    model_creator: { id: 'moonshot', name: 'Moonshot' },
    evaluations: { artificial_analysis_coding_index: 76.2 },
    pricing: { price_1m_input_tokens: 3, price_1m_output_tokens: 15 }, performance: {} }] };

test('AA Kimi K3 input $3 / output $15 keeps the $6.00/1M blended cost in both letter formats', async () => {
  const run = await runInsightsOnce({ ports: [{ id: 'artificial-analysis', fetch: async () => aaData, parse: parseAaResponse }],
    history: new MemoryInsightHistory(), now: () => NOW });
  const top10 = run.top10!;
  const kimi = top10.records.find(r => r.modelId === 'kimi-k3' && r.metric === 'artificial_analysis_coding_index')!;
  assert.deepEqual([kimi.priceInput, kimi.priceOutput], [3, 15]);
  const compact = renderTop10FromRecords({ publicationDate: run.publicationDate, ...top10 });
  assert.match(compact, /kimi-k3 · effort \S+ · 스코어 \S+ · 76\.2 · \$6\.00\/1M/);
  const md = renderTop10MarkdownFromRecords({ publicationDate: run.publicationDate, ...top10 });
  assert.match(md, /\| kimi-k3 \| \S+ \| \S+ \| 76\.2 \| \$6\.00\/1M \|/);
});
test('a one-sided or missing AA price never invents a blended cost', async () => {
  const oneSided = { ...aaData, data: [{ ...aaData.data[0]!, pricing: { price_1m_input_tokens: 3 } }] };
  const run = await runInsightsOnce({ ports: [{ id: 'artificial-analysis', fetch: async () => oneSided, parse: parseAaResponse }],
    history: new MemoryInsightHistory(), now: () => NOW });
  const kimi = run.top10!.records.find(r => r.modelId === 'kimi-k3')!;
  assert.equal(kimi.priceInput, 3);
  assert.equal(kimi.priceOutput, undefined);
  const compact = renderTop10FromRecords({ publicationDate: run.publicationDate, ...run.top10! });
  assert.match(compact, /kimi-k3[^\n]*단가 -/);
  assert.doesNotMatch(compact, /\$[\d.]+\/1M/);
});
