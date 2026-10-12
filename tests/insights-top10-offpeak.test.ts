import assert from 'node:assert/strict';
import test from 'node:test';
import { OFF_PEAK_RATES, OFF_PEAK_ALIASES, OFF_PEAK_TODO, DEEPSEEK_OFF_PEAK_WINDOW, OLLAMA_OFF_PEAK_WINDOW,
  findOffPeakRate, isOffPeakHour, type OffPeakRate } from '../src/insights/model-price-overrides.js';
import { computeUnifiedTop10 } from '../src/insights/letter-top10-unified.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import { parseAaResponse } from '../src/insights/aa-parser.js';

test('verified DeepSeek off-peak rates with source and date; provider windows stay separate', () => {
  const rate = OFF_PEAK_RATES['deepseek-v4-1-flash']!;
  assert.equal(rate.input, 0.15);
  assert.equal(rate.output, 0.6);
  assert.match(rate.sourceUrl, /^https:\/\/api-docs\.deepseek\.com\//);
  assert.equal(rate.checkedOn, '2026-10-12');
  assert.deepEqual(DEEPSEEK_OFF_PEAK_WINDOW.peakUtc, ['01:00-04:00', '06:00-10:00']);
  assert.deepEqual(OLLAMA_OFF_PEAK_WINDOW.peakUtc, ['12:00-18:00']);
  assert.notDeepEqual(DEEPSEEK_OFF_PEAK_WINDOW.peakUtc, OLLAMA_OFF_PEAK_WINDOW.peakUtc);
  assert.equal(findOffPeakRate('deepseek-4-1-flash', OFF_PEAK_RATES), rate); // AA 표기 별칭 해석
  assert.equal(findOffPeakRate('deepseek-v4-flash', OFF_PEAK_RATES), rate); // 공식 페이지: legacy 이름이 V4.1-Flash로 청구
  assert.equal(findOffPeakRate('unknown-model', OFF_PEAK_RATES), undefined);
  assert.ok(OFF_PEAK_TODO.every(t => t.note.includes('미확인')));
  assert.equal(OFF_PEAK_ALIASES['deepseek-4-1-flash'], 'deepseek-v4-1-flash');
});
test('the verified off-peak rate drives blended cost/efficiency and marks the row off-peak', () => {
  const records = [{ modelId: 'deepseek-v4-1-flash', value: 90, priceInput: 0.3, priceOutput: 1.2,
    metric: 'artificial_analysis_intelligence_index' }];
  const entry = computeUnifiedTop10(records).entries[0]!; // 기본 OFF_PEAK_RATES 적용
  assert.equal(entry.blendedCostText, '$0.26/1M'); // (3*0.15+0.6)/4=0.2625
  assert.equal(entry.offPeak, true);
});
test('an injected override still wins and unknown cost stays strict', () => {
  const rate: OffPeakRate = { input: 0.2, output: 0.4, sourceUrl: 'https://example.invalid/off-peak', checkedOn: '2026-10-12', provider: 'ollama-cloud' };
  const records = [{ modelId: 'deepseek-v4-1-flash', value: 90, priceInput: 1, priceOutput: 2, metric: 'artificial_analysis_intelligence_index' }];
  const entry = computeUnifiedTop10(records, { priceOverrides: { 'deepseek-v4-1-flash': rate } }).entries[0]!;
  assert.equal(entry.blendedCostText, '$0.25/1M');
  assert.equal(entry.offPeak, true);
});

test('the AA modelId deepseek-v4-flash uses off-peak through the official legacy-name alias', () => {
  const records = [{ modelId: 'deepseek-v4.1-flash', value: 69.1, priceInput: 0.3, priceOutput: 1.2,
    metric: 'artificial_analysis_intelligence_index' }];
  const entry = computeUnifiedTop10(records).entries[0]!;
  assert.equal(entry.blendedCostText, '$0.26/1M');
  assert.equal(entry.offPeak, true);
});

test('isOffPeakHour recognizes peak vs off-peak hours and weekends for DeepSeek & Ollama', () => {
  assert.equal(isOffPeakHour('2026-10-12T02:00:00Z', 'deepseek-platform'), false); // Mon 02:00 UTC = peak
  assert.equal(isOffPeakHour('2026-10-12T00:00:00Z', 'deepseek-platform'), true);  // Mon 00:00 UTC = off-peak
  assert.equal(isOffPeakHour('2026-10-11T02:00:00Z', 'deepseek-platform'), true);  // Sun = weekend off-peak
  assert.equal(isOffPeakHour('2026-10-12T14:00:00Z', 'ollama-cloud'), false);       // Mon 14:00 UTC = peak
  assert.equal(isOffPeakHour('2026-10-12T00:00:00Z', 'ollama-cloud'), true);        // Mon 00:00 UTC = off-peak
});

test('runInsightsOnce operational path reflects peak vs off-peak time for deepseek-v4-flash', async () => {
  const aaData = { tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 1, total_pages: 1, has_more: false },
    data: [{ id: 'deepseek-v4-flash', slug: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', release_date: null,
      model_creator: { id: 'deepseek', name: 'DeepSeek' },
      evaluations: { artificial_analysis_intelligence_index: 69.1 },
      pricing: { price_1m_input_tokens: 0.3, price_1m_output_tokens: 1.2 }, performance: {} }] };
  const mkDeps = (nowIso: string) => ({
    ports: [{ id: 'artificial-analysis' as const, fetch: async () => aaData, parse: parseAaResponse }],
    history: new MemoryInsightHistory(), now: () => nowIso,
  });
  const peakRun = await runInsightsOnce(mkDeps('2026-10-12T02:00:00Z')); // weekday 02:00 UTC = peak
  const offPeakRun = await runInsightsOnce(mkDeps('2026-10-12T00:00:00Z')); // weekday 00:00 UTC = off-peak
  assert.equal(peakRun.top10?.observedAt, '2026-10-12T02:00:00Z');
  assert.equal(offPeakRun.top10?.observedAt, '2026-10-12T00:00:00Z');
  assert.ok(peakRun.top10?.nowUtc && offPeakRun.top10?.nowUtc);
  const peakUnified = computeUnifiedTop10(peakRun.top10.records, { nowUtc: peakRun.top10.nowUtc });
  const offPeakUnified = computeUnifiedTop10(offPeakRun.top10.records, { nowUtc: offPeakRun.top10.nowUtc });
  assert.equal(peakUnified.entries[0]?.blendedCostText, '$0.52/1M');
  assert.equal(peakUnified.entries[0]?.offPeak, undefined);
  assert.equal(offPeakUnified.entries[0]?.blendedCostText, '$0.26/1M');
  assert.equal(offPeakUnified.entries[0]?.offPeak, true);
});
