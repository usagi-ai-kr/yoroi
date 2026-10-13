import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import type { InsightHistoryPort } from '../src/insights/history-port.js';
import type { InsightRecord, InsightSource } from '../src/insights/record.js';
import type { InsightSourcePort } from '../src/insights/source-port.js';
import { validateInsightRecord } from '../src/insights/validation.js';
import { parseAaPages } from '../src/insights/sources-aa.js';
import { parseOpenRouterResponse } from '../src/insights/openrouter-parser.js';
import { runInsightsOnce } from '../src/insights/run-once.js';

const AT = '2026-10-13T00:00:00.000Z';
const LEGACY_AA = 'aa-v2:free:language-models:coding-intel-value-top50';
const LEGACY_OR = 'rankings-daily:day:top50';
const aaPage = { tier: 'free', intelligence_index_version: 4, pagination: { page: 1, page_size: 200, total_pages: 1, has_more: false },
  data: [['claude-opus-5-5', 100, 95], ['glm-5-3-flash', 70, 99]].map(([slug, intel, coding]) => ({ id: slug, slug, name: slug,
    release_date: null, model_creator: { id: 'c', name: 'C' },
    evaluations: { artificial_analysis_intelligence_index: intel, artificial_analysis_coding_index: coding },
    pricing: { price_1m_input_tokens: 1, price_1m_output_tokens: 2 }, performance: { median_output_tokens_per_second: 40 } })) };
const orPage = { meta: { as_of: '2026-10-12T00:00:00Z', start_date: '2026-10-01', end_date: '2026-10-12', version: 'v1' },
  data: [{ date: '2026-10-12', model_permaslug: 'or-a', total_tokens: 500 }, { date: '2026-10-11', model_permaslug: 'or-b', total_tokens: 400 }] };
const aaPort = (count: () => void): InsightSourcePort => ({ id: 'artificial-analysis',
  fetch: async () => { count(); return [{ page: 1, payload: aaPage }]; }, parse: (p, at) => parseAaPages(p, at, {}) });
const orPort: InsightSourcePort = { id: 'openrouter', fetch: async () => orPage, parse: (p, at) => parseOpenRouterResponse(p, at) };
const aaRec = (modelId: string, metric: string, value: number): InsightRecord => ({ source: 'artificial-analysis', modelId,
  metric, value, unit: 'score', category: 'language-models', observedAt: '2026-10-12T00:00:00Z', sourceAsOf: '2026-10-12T00:00:00Z',
  sourceUrl: 'https://artificialanalysis.ai', sourceName: 'Artificial Analysis', license: null, attributionText: 'x',
  method: 'official-api', schemaVersion: 'aa-v2-free' });
const orRec = (modelId: string, value: number, date: string): InsightRecord => ({ source: 'openrouter', modelId, metric: 'total_tokens',
  value, unit: 'tokens', category: 'usage', observedAt: '2026-10-12T00:00:00Z', sourceAsOf: '2026-10-12T00:00:00Z',
  sourceUrl: 'https://openrouter.ai/rankings', sourceName: 'OpenRouter', license: 'CC-BY-4.0', attributionText: 'x',
  method: 'official-api', schemaVersion: 'openrouter-rankings-v1', metadata: { date } });
function save(history: MemoryInsightHistory, source: InsightSource, scope: string, records: readonly InsightRecord[]): void {
  const validated = records.map(r => { const v = validateInsightRecord(r); assert.ok(v.ok); return v.value; });
  const schemaVersion = source === 'openrouter' ? 'openrouter-rankings-v1' : 'aa-v2-free';
  assert.equal(history.saveDaily({ source, publicationDate: '2026-10-12', requestScope: scope, schemaVersion },
    { ok: true, source, rejectedRows: 0, records: validated }), true);
}
const run = (history: InsightHistoryPort, ports: readonly InsightSourcePort[]) => runInsightsOnce({ ports, history, now: () => AT });

test('AA 전일: 새 scope가 비면 구 scope로 조회해 전일 순위를 쓴다', async () => {
  const history = new MemoryInsightHistory();
  save(history, 'artificial-analysis', LEGACY_AA, [aaRec('claude-opus-5-5', 'artificial_analysis_intelligence_index', 100),
    aaRec('claude-opus-5-5', 'artificial_analysis_coding_index', 95)]);
  const result = await run(history, [aaPort(() => {})]);
  assert.ok(result.top10?.previousRanks.some(r => r.modelId === 'claude-opus-5-5')); // 🌱 아님
});

test('OpenRouter 전일: 새 scope가 비면 구 scope로 조회해 보류 경고가 사라진다', async () => {
  const history = new MemoryInsightHistory();
  save(history, 'artificial-analysis', LEGACY_AA, [aaRec('claude-opus-5-5', 'artificial_analysis_intelligence_index', 100)]);
  save(history, 'openrouter', LEGACY_OR, [orRec('or-b', 400, '2026-10-11')]);
  const result = await run(history, [aaPort(() => {}), orPort]);
  assert.ok(!(result.top10?.warnings ?? []).some(w => w.includes('전일 OpenRouter 자료 없음')));
  assert.ok(result.top10?.previousRanks.some(r => r.modelId === 'claude-opus-5-5'));
});

test('새 scope 저장본이 있으면 구 scope보다 우선한다', async () => {
  const history = new MemoryInsightHistory();
  save(history, 'artificial-analysis', 'aa-v2:free:language-models:all',
    [aaRec('claude-opus-5-5', 'artificial_analysis_intelligence_index', 100)]);
  save(history, 'artificial-analysis', LEGACY_AA, [aaRec('glm-5-3-flash', 'artificial_analysis_intelligence_index', 70)]);
  const result = await run(history, [aaPort(() => {})]);
  const ids = (result.top10?.previousRanks ?? []).map(r => r.modelId);
  assert.ok(ids.includes('claude-opus-5-5') && !ids.includes('glm-5-3-flash'));
});

test('오늘 수집·캐시 재사용은 구 scope를 보지 않는다', async () => {
  const history = new MemoryInsightHistory();
  save(history, 'artificial-analysis', LEGACY_AA, [aaRec('claude-opus-5-5', 'artificial_analysis_intelligence_index', 100)]); // 오늘 날짜인데 구 scope
  let calls = 0; const ports = [aaPort(() => { calls += 1; }), orPort];
  const first = await run(history, ports);
  assert.equal(calls, 1); // 구 scope 저장본을 오늘 결과로 재사용하지 않고 수집
  assert.equal(first.sources.find(r => r.source === 'artificial-analysis')?.status, 'collected');
  const again = await run(history, ports);
  assert.equal(calls, 1); // 새 scope 저장본으로 재사용
  assert.equal(again.sources.find(r => r.source === 'artificial-analysis')?.status, 'reused');
});
