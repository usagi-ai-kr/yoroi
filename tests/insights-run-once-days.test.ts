import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAaResponse } from '../src/insights/aa-parser.js';
import { parseArenaRows } from '../src/insights/arena-parser.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import type { LetterEvidence, LetterRankEvidence, LetterSection } from '../src/insights/letter-sections.js';
import { runInsightsOnce } from '../src/insights/run-once.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';

const row = (i: number, date: string, rating: number) => ({ model_name: `m${i}`, organization: 'o', license: 'L', rating, rating_lower: rating - 10, rating_upper: rating + 10,
  variance: 2, vote_count: 10 + i, rank: i + 1, category: 'overall', leaderboard_publish_date: date });
const aaPayload = { tier: 'free', intelligence_index_version: 3, pagination: { page: 1, page_size: 10, total_pages: 1, has_more: false },
  data: [{ id: 'a', slug: 'a', name: 'A', release_date: null, model_creator: { id: 'c', name: 'C' }, evaluations: { artificial_analysis_intelligence_index: 42 }, pricing: {}, performance: {} }] };
/** Arena publishes `date` with the given ratings; AA has no source date. Real parsers, fake fetch. */
const ports = (date: string, ratings: number[]): InsightSourcePort[] => [
  { id: 'arena', fetch: async () => ratings.map((r, i) => row(i, date, r)), parse: (p, at) => parseArenaRows(p as unknown[], at) },
  { id: 'artificial-analysis', fetch: async () => aaPayload, parse: parseAaResponse }];
const day = (n: number) => () => new Date(Date.parse('2026-10-08T00:30:00Z') + n * 86_400_000).toISOString();
const section = <K extends LetterSection['kind']>(run: { letter: { ok: boolean; sections?: readonly LetterSection[] } }, kind: K) =>
  run.letter.sections!.find(s => s.kind === kind) as Extract<LetterSection, { kind: K }>;
const evidence = (rows: readonly LetterEvidence[], source: string, model: string, metric: string) => rows.find(r => r.source === source && r.modelId === model && r.metric === metric)!;

test('next-day run compares only against the exact previous day and ranks against the stored previous snapshot', async () => {
  const history = new MemoryInsightHistory();
  await runInsightsOnce({ history, ports: ports('2026-10-08', [1500, 1490, 1480]), now: day(0) });
  const run = await runInsightsOnce({ history, ports: ports('2026-10-09', [1480, 1510, 1470]), now: day(1) });
  const rows = section(run, 'evidence').rows, m0 = evidence(rows, 'arena', 'm0', 'rating');
  assert.deepEqual([m0.comparison.comparable, m0.comparison.comparable && m0.comparison.absoluteChange, m0.comparison.comparable && m0.comparison.previousDate], [true, -20, '2026-10-08']);
  assert.equal(evidence(rows, 'artificial-analysis', 'a', 'artificial_analysis_intelligence_index').comparison.comparable, false);
  assert.match(JSON.stringify(evidence(rows, 'artificial-analysis', 'a', 'artificial_analysis_intelligence_index').comparison), /기준일 미상/);
  const group = section(run, 'ranks').groups.find((g: LetterRankEvidence) => g.source === 'arena')!;
  assert.ok(group.result.comparable); const m1 = group.result.changes.find(c => c.modelId === 'm1')!;
  assert.deepEqual([m1.currentRank, m1.previousRank, m1.rankChange], [1, 2, 1]);
});
test('a skipped day is reported as a missing previous day, never filled with the nearest older observation', async () => {
  const history = new MemoryInsightHistory();
  await runInsightsOnce({ history, ports: ports('2026-10-08', [1500, 1490]), now: day(0) });
  const run = await runInsightsOnce({ history, ports: ports('2026-10-10', [1495, 1490]), now: day(2) });
  assert.deepEqual(evidence(section(run, 'evidence').rows, 'arena', 'm0', 'rating').comparison, { comparable: false, reason: 'n/a: 전일 결측' });
});
test('the evidence cut keeps the largest real changes first', async () => {
  const history = new MemoryInsightHistory();
  await runInsightsOnce({ history, ports: ports('2026-10-08', [1500, 1490, 1480]), now: day(0) });
  const run = await runInsightsOnce({ history, ports: ports('2026-10-09', [1500, 1400, 1480]), now: day(1), evidenceLimit: 3 });
  const arena = section(run, 'evidence').rows.filter(r => r.source === 'arena');
  assert.deepEqual(arena.map(r => [r.modelId, r.metric]), [['m1', 'rating'], ['m1', 'rating_lower'], ['m1', 'rating_upper']]);
  assert.equal(arena[0]!.value, 1400);
});
test('history older than 90 publication days is pruned after the run and the count is reported', async () => {
  const history = new MemoryInsightHistory();
  await runInsightsOnce({ history, ports: ports('2026-10-08', [1500, 1490]), now: day(0) });
  const later = await runInsightsOnce({ history, ports: ports('2027-01-16', [1500, 1490]), now: day(100) });
  assert.deepEqual([later.pruned, later.exitCode], [2, 0]);
  assert.equal(history.getDaily({ source: 'arena', publicationDate: '2026-10-08', requestScope: 'hf-rows:text:latest:overall', schemaVersion: 'arena-hf-v1' }), undefined);
  const today = await runInsightsOnce({ history, ports: ports('2027-01-16', [1500, 1490]), now: day(100) });
  assert.ok(today.sources.every(s => s.status === 'reused') && today.pruned === 0);
});
