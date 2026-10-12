import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { buildPreviousRanks } from '../src/insights/letter-top10-history.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';

const rec = (modelId: string, metric: string, value: number, date: string): ValidatedInsightRecord => {
  const result = validateInsightRecord({ source: 'artificial-analysis', modelId, metric, value, unit: 'score',
    category: 'language-models', observedAt: `${date}T00:00:00Z`, sourceAsOf: date, sourceUrl: 'https://artificialanalysis.ai',
    sourceName: 'Artificial Analysis', license: null, attributionText: 'x', method: 'official-api',
    schemaVersion: 'aa-v2-free' } as InsightRecord);
  assert.ok(result.ok); return result.value;
};
const orRec = (modelId: string, value: number, date: string): ValidatedInsightRecord => {
  const result = validateInsightRecord({ source: 'openrouter', modelId, metric: 'total_tokens', value, unit: 'tokens',
    category: 'usage', observedAt: `${date}T00:00:00Z`, sourceAsOf: date, sourceUrl: 'https://openrouter.ai',
    sourceName: 'OpenRouter', license: 'CC-BY-4.0', attributionText: 'x', method: 'official-api',
    schemaVersion: 'openrouter-rankings-v1', metadata: { date } } as InsightRecord);
  assert.ok(result.ok); return result.value;
};
test('identical AA+OR snapshots compare with OR on both sides: eff tie broken by OR, below-threshold excluded, all 유지', () => {
  const history = new MemoryInsightHistory();
  const idx = 'artificial_analysis_intelligence_index';
  const aa = [rec('gpt-6-1-sol', idx, 90, '2026-10-11'), rec('claude-opus-5-5', idx, 80, '2026-10-11'), rec('claude-haiku-5-5', idx, 60, '2026-10-11'),
    rec('gpt-6-1-sol', 'price_1m_input_tokens', 10, '2026-10-11'), rec('gpt-6-1-sol', 'price_1m_output_tokens', 10, '2026-10-11'),
    rec('claude-opus-5-5', 'price_1m_input_tokens', 12, '2026-10-11'), rec('claude-opus-5-5', 'price_1m_output_tokens', 12, '2026-10-11')];
  const or = [orRec('gpt-6-1-sol', 300, '2026-10-11'), orRec('claude-opus-5-5', 100, '2026-10-11')];
  assert.equal(history.saveDaily({ source: 'openrouter', publicationDate: '2026-10-11',
    requestScope: 'rankings-daily:day:top50', schemaVersion: 'openrouter-rankings-v1' },
    { ok: true, source: 'openrouter', rejectedRows: 0, records: or }), true);
  const current: Top10RecordInput[] = [
    { modelId: 'gpt-6-1-sol', value: 90, metric: idx, priceInput: 10, priceOutput: 10 },
    { modelId: 'claude-opus-5-5', value: 80, metric: idx, priceInput: 12, priceOutput: 12 },
    { modelId: 'claude-haiku-5-5', value: 60, metric: idx, priceInput: 1, priceOutput: 1 }];
  const noOr = computeRoleTop10(current).orchestrator.entries.map(e => `${e.modelId}${e.rank}`);
  assert.deepEqual(noOr, ['gpt-6-1-sol1', 'claude-opus-5-52']); // 가성비 9 > 6.67
  const build = buildPreviousRanks(history, '2026-10-12', { ok: true, source: 'artificial-analysis', rejectedRows: 0, records: aa },
    'rankings-daily:day:top50', 'openrouter-rankings-v1', true);
  assert.deepEqual(build.warnings, []);
  const orInputs: Top10RecordInput[] = or.map(v => ({ modelId: v.record.modelId, value: v.record.value, metric: 'total_tokens' }));
  const withOr = computeRoleTop10(current, { openrouterRecords: orInputs, previousCohort: build.ranks });
  assert.deepEqual(withOr.orchestrator.entries.map(e => [e.modelId, e.rank, e.change]), [['gpt-6-1-sol', 1, '유지'], ['claude-opus-5-5', 2, '유지']]);
  assert.deepEqual(withOr.orchestrator.exits, []);
});
test('missing previous OR data yields an explicit hold instead of an estimated comparison', () => {
  const build = buildPreviousRanks(new MemoryInsightHistory(), '2026-10-12', undefined, 'rankings-daily:day:top50', 'openrouter-rankings-v1', true);
  assert.deepEqual(build.ranks, []);
  assert.match(build.warnings[0]!, /전일 OpenRouter 자료 없음/);
});
