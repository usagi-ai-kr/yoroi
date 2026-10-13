import assert from 'node:assert/strict';
import test from 'node:test';
import type { InsightRecord } from '../src/insights/record.js';
import { MODEL_SUCCESSORS, expandSuccessors } from '../src/insights/model-successors.js';
import { REGULAR_RATES, findRegularRate } from '../src/insights/model-price-overrides.js';

const mockRecord = (modelId: string, metric: string, value: number, source: 'artificial-analysis' | 'openrouter' = 'artificial-analysis'): InsightRecord => ({
  source, modelId, metric, value, unit: metric.startsWith('price_') ? 'USD/1M tokens' : 'score',
  category: 'language-models', observedAt: '2026-10-12T00:00:00Z', sourceAsOf: '2026-10-12T00:00:00Z',
  sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis', license: null,
  attributionText: 'Source: Artificial Analysis', method: 'official-api', schemaVersion: 'aa-v2-free',
});

test('MODEL_SUCCESSORS defines deepseek-v4.1-flash successor rule with basis and source', () => {
  assert.equal(MODEL_SUCCESSORS.length, 1);
  const rule = MODEL_SUCCESSORS[0]!;
  assert.equal(rule.successor, 'deepseek-v4.1-flash');
  assert.equal(rule.predecessor, 'deepseek-v4-flash');
  assert.match(rule.basis, /4\.1 Flash가 4 Flash보다 상위/);
  assert.equal(rule.priceSource, 'https://api-docs.deepseek.com/quick_start/pricing');
});

test('REGULAR_RATES defines official regular price for deepseek-v4-1-flash and findRegularRate resolves it', () => {
  const rate = findRegularRate('deepseek-v4.1-flash');
  assert.ok(rate);
  assert.equal(rate?.input, 0.3); assert.equal(rate?.output, 1.2);
  assert.equal(rate?.provider, 'deepseek-platform');
  assert.equal(findRegularRate('unknown-model'), undefined);
});

test('expandSuccessors adds successor when only predecessor exists with floor indices and official regular price', () => {
  const records: InsightRecord[] = [
    mockRecord('deepseek-v4-flash', 'artificial_analysis_intelligence_index', 69.1),
    mockRecord('deepseek-v4-flash', 'artificial_analysis_coding_index', 75.0),
    mockRecord('deepseek-v4-flash', 'median_output_tokens_per_second', 42.5),
    mockRecord('deepseek-v4-flash', 'price_1m_input_tokens', 0.1),
    mockRecord('deepseek-v4-flash', 'price_1m_output_tokens', 0.4),
  ];

  const expanded = expandSuccessors(records);
  assert.equal(expanded.length, records.length + 5);

  const succRecords = expanded.filter(r => r.modelId === 'deepseek-v4.1-flash');
  assert.equal(succRecords.length, 5);

  const intel = succRecords.find(r => r.metric === 'artificial_analysis_intelligence_index');
  assert.equal(intel?.value, 69.1);
  assert.equal(intel?.metadata?.successorOf, 'deepseek-v4-flash');
  assert.equal(intel?.metadata?.indexBasis, 'predecessor-floor');

  const coding = succRecords.find(r => r.metric === 'artificial_analysis_coding_index');
  assert.equal(coding?.value, 75.0);
  assert.equal(coding?.metadata?.successorOf, 'deepseek-v4-flash');
  assert.equal(coding?.metadata?.indexBasis, 'predecessor-floor');

  const speed = succRecords.find(r => r.metric === 'median_output_tokens_per_second');
  assert.equal(speed?.value, 42.5);

  // 가격 metric은 선행 모델 가격(0.1, 0.4)을 복사하지 않고 공식 정상 단가(0.3, 1.2) 사용
  const inputPrice = succRecords.find(r => r.metric === 'price_1m_input_tokens');
  assert.equal(inputPrice?.value, 0.3);
  assert.equal(inputPrice?.metadata?.successorOf, 'deepseek-v4-flash');
  assert.equal(inputPrice?.metadata?.priceBasis, 'official-regular');

  const outputPrice = succRecords.find(r => r.metric === 'price_1m_output_tokens');
  assert.equal(outputPrice?.value, 1.2);
});

test('expandSuccessors handles existing successor, missing predecessor, and non-AA sources', () => {
  const existing = [mockRecord('deepseek-v4-flash', 'artificial_analysis_intelligence_index', 69.1),
    mockRecord('deepseek-v4.1-flash', 'artificial_analysis_intelligence_index', 72.0)];
  assert.equal(expandSuccessors(existing).length, 2);

  const missing = [mockRecord('other-model', 'artificial_analysis_intelligence_index', 80.0)];
  assert.equal(expandSuccessors(missing).length, 1);

  const nonAa = [mockRecord('deepseek-v4-flash', 'artificial_analysis_intelligence_index', 69.1, 'openrouter')];
  assert.equal(expandSuccessors(nonAa).length, 1);
});
test('successor floor rows drop the predecessor releaseDate so the release rule keeps the copied coding floor', async () => {
  const { buildCandidatePool } = await import('../src/insights/letter-top10-candidates.js');
  const dated = (r: InsightRecord, releaseDate: string): InsightRecord => ({ ...r, metadata: { releaseDate } });
  const out = expandSuccessors([dated(mockRecord('deepseek-v4-flash', 'artificial_analysis_coding_index', 69.1), '2026-07-31'),
    dated(mockRecord('deepseek-v4-1-flash', 'artificial_analysis_intelligence_index', 39.5), '2026-09-10')]);
  const copied = out.filter(r => r.metadata?.indexBasis === 'predecessor-floor');
  assert.ok(copied.length > 0 && copied.every(r => r.metadata?.releaseDate === undefined));
  const pool = buildCandidatePool(out.map(r => ({ modelId: r.modelId, value: r.value, metric: r.metric,
    ...(typeof r.metadata?.successorOf === 'string' && { successorOf: r.metadata.successorOf }),
    ...(typeof r.metadata?.releaseDate === 'string' && { releaseDate: r.metadata.releaseDate }) })));
  assert.ok(pool.accessibleRecords.some(r => r.metric === 'artificial_analysis_coding_index' && r.value === 69.1));
});
