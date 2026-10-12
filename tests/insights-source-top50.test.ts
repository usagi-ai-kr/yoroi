import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { RANK_COHORTS, buildRanks } from '../src/insights/run-once-steps.js';
import { validateInsightRecord, type ValidatedInsightRecord } from '../src/insights/validation.js';
import type { InsightRecord } from '../src/insights/record.js';

const rec = (source: InsightRecord['source'], modelId: string, metric: string, value: number, comparisonDate: string | null): ValidatedInsightRecord => {
  const result = validateInsightRecord({ source, modelId, metric, value, unit: source === 'openrouter' ? 'tokens' : 'score',
    category: source === 'openrouter' ? 'usage' : 'overall', observedAt: '2026-10-12T00:00:00Z',
    sourceAsOf: comparisonDate ?? '2026-10-12', ...(comparisonDate === null ? {} : { metadata: { date: comparisonDate } }),
    sourceUrl: 'https://example.test', sourceName: 'Synthetic', license: null, attributionText: 'x',
    method: 'official-api', schemaVersion: 'v1' } as InsightRecord);
  assert.ok(result.ok);
  return result.value;
};

test('AA rank cohorts cover coding and intelligence metrics with a top-50 window', () => {
  const records = [rec('artificial-analysis', 'a1', 'artificial_analysis_coding_index', 90, null),
    rec('artificial-analysis', 'a1', 'artificial_analysis_intelligence_index', 80, null),
    rec('artificial-analysis', 'a2', 'artificial_analysis_coding_index', 70, null),
    rec('artificial-analysis', 'a2', 'artificial_analysis_intelligence_index', 95, null)];
  const groups = buildRanks(new MemoryInsightHistory(), 'scope', '2026-10-12',
    { ok: true, source: 'artificial-analysis', records, rejectedRows: 0 }, true, 5);
  assert.deepEqual(groups.map(group => group.reference.record.metric),
    ['artificial_analysis_coding_index', 'artificial_analysis_intelligence_index']);
  assert.ok(groups.every(group => !group.result.comparable && group.result.reason === 'n/a: 기준일 미상'));
  assert.ok(RANK_COHORTS['artificial-analysis'].extraMetrics?.includes('artificial_analysis_intelligence_index'));
});
test('OpenRouter ranks only the latest comparison date and never bridges to an unmatched previous day', () => {
  const store = new MemoryInsightHistory();
  const latest = '2026-10-10', prior = '2026-10-09';
  const current = { ok: true as const, source: 'openrouter' as const, rejectedRows: 0, records: [
    rec('openrouter', 'm1', 'total_tokens', 500, prior), rec('openrouter', 'm1', 'total_tokens', 700, latest),
    rec('openrouter', 'm2', 'total_tokens', 900, prior), rec('openrouter', 'm2', 'total_tokens', 400, latest)] };
  const stored = { ok: true as const, source: 'openrouter' as const, rejectedRows: 0, records: [
    rec('openrouter', 'm1', 'total_tokens', 600, prior), rec('openrouter', 'm2', 'total_tokens', 800, prior)] };
  store.saveDaily({ source: 'openrouter', publicationDate: '2026-10-09', requestScope: 'scope', schemaVersion: 'v1' }, stored);
  const groups = buildRanks(store, 'scope', '2026-10-10', current, true, 5);
  assert.equal(groups.length, 1);
  const group = groups[0]!;
  assert.equal(group.reference.comparisonDate, latest, 'rank cohort uses the latest comparison date');
  assert.equal(group.previousDate, prior, 'previous is the exact preceding comparison date');
  const result = group.result;
  assert.ok(result.comparable, JSON.stringify(result));
  const changes = result.changes;
  assert.deepEqual(changes.map(change => change.modelId), ['m1', 'm2']);
  for (const [modelId, currentRank, previousRank, rankChange] of
    [['m1', 1, 2, 1], ['m2', 2, 1, -1]] as const) {
    const change = changes.find(entry => entry.modelId === modelId)!;
    assert.deepEqual({ status: change.status, currentRank: change.currentRank, previousRank: change.previousRank,
      rankChange: change.rankChange, windowSize: change.windowSize },
    { status: 'ranked', currentRank, previousRank, rankChange, windowSize: 50 }, modelId);
  }
});
