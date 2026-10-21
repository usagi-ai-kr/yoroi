import assert from 'node:assert/strict';
import test from 'node:test';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';
import { buildPreviousRanks } from '../src/insights/letter-top10-history.js';
import { computeRoleTop10, previousRanks } from '../src/insights/letter-top10-unified.js';
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
test('identical AA+OR snapshots compare with OR on both sides: below-threshold fill and history match', () => {
  const history = new MemoryInsightHistory();
  const idx = 'artificial_analysis_intelligence_index';
  const aa = [rec('gpt-6-1-sol', idx, 90, '2026-10-11'), rec('claude-opus-5-5', idx, 80, '2026-10-11'), rec('claude-haiku-5-5', idx, 60, '2026-10-11'),
    rec('gpt-6-1-sol', 'price_1m_input_tokens', 1, '2026-10-11'), rec('gpt-6-1-sol', 'price_1m_output_tokens', 1, '2026-10-11'),
    rec('claude-opus-5-5', 'price_1m_input_tokens', 1.2, '2026-10-11'), rec('claude-opus-5-5', 'price_1m_output_tokens', 1.2, '2026-10-11'),
    rec('claude-haiku-5-5', 'price_1m_input_tokens', 1, '2026-10-11'), rec('claude-haiku-5-5', 'price_1m_output_tokens', 1, '2026-10-11')]; // 오늘과 같은 단가
  const or = [orRec('gpt-6-1-sol', 300, '2026-10-11'), orRec('claude-opus-5-5', 100, '2026-10-11')];
  assert.equal(history.saveDaily({ source: 'openrouter', publicationDate: '2026-10-11',
    requestScope: 'rankings-daily:day:top50', schemaVersion: 'openrouter-rankings-v1' },
    { ok: true, source: 'openrouter', rejectedRows: 0, records: or }), true);
  const current: Top10RecordInput[] = [
    { modelId: 'gpt-6-1-sol', value: 90, metric: idx, priceInput: 1, priceOutput: 1 },
    { modelId: 'claude-opus-5-5', value: 80, metric: idx, priceInput: 1.2, priceOutput: 1.2 },
    { modelId: 'claude-haiku-5-5', value: 60, metric: idx, priceInput: 1, priceOutput: 1 }];
  const noOr = computeRoleTop10(current).orchestrator.entries.map(e => `${e.modelId}${e.rank}`);
  assert.deepEqual(noOr, ['gpt-6-1-sol1', 'claude-opus-5-52', 'claude-haiku-5-53']); // O 허용: haiku 3위 합류
  const build = buildPreviousRanks(history, '2026-10-12', { ok: true, source: 'artificial-analysis', rejectedRows: 0, records: aa },
    'rankings-daily:day:top50', 'openrouter-rankings-v1', true);
  assert.deepEqual(build.warnings, []);
  const orInputs: Top10RecordInput[] = or.map(v => ({ modelId: v.record.modelId, value: v.record.value, metric: 'total_tokens' }));
  const withOr = computeRoleTop10(current, { openrouterRecords: orInputs, previousCohort: build.ranks });
  assert.deepEqual(withOr.orchestrator.entries.map(e => [e.modelId, e.rank, e.change]), [['gpt-6-1-sol', 1, '유지'], ['claude-opus-5-5', 2, '유지'], ['claude-haiku-5-5', 3, '유지']]); // O 허용 반영
  assert.deepEqual(withOr.orchestrator.exits, []);
});
test('missing previous OR data yields an explicit hold instead of an estimated comparison', () => {
  const build = buildPreviousRanks(new MemoryInsightHistory(), '2026-10-12', undefined, 'rankings-daily:day:top50', 'openrouter-rankings-v1', true);
  assert.deepEqual(build.ranks, []);
  assert.match(build.warnings[0]!, /전일 OpenRouter 자료 없음/);
});

// p48: 워커 전일 순위는 Cognition·OR 근거(w1 wiring 테스트)로 옮겨, AA 후속·릴리스 규칙은 오케스트레이터 경로에서 검증한다.
test('historical successor takes predecessor rank through the shared candidate pipeline', () => {
  const history = new MemoryInsightHistory(), date = '2026-10-12', code = 'artificial_analysis_intelligence_index';
  const aa = [rec('deepseek-v4-flash', code, 69, date), rec('deepseek-v4-flash', 'price_1m_input_tokens', 0.3, date),
    rec('deepseek-v4-flash', 'price_1m_output_tokens', 1.2, date), rec('glm-5-3-flash', code, 71.5, date),
    rec('glm-5-3-flash', 'price_1m_input_tokens', 0.01, date), rec('glm-5-3-flash', 'price_1m_output_tokens', 0.01, date),
    rec('deepseek-v4-1-flash', 'price_1m_input_tokens', 0.3, date), rec('deepseek-v4-1-flash', 'price_1m_output_tokens', 1.2, date)];
  const baseline = previousRanks([{ modelId: 'deepseek-v4-flash', metric: code, value: 69, priceInput: 0.3, priceOutput: 1.2 },
    { modelId: 'glm-5-3-flash', metric: code, value: 71.5, priceInput: 0.01, priceOutput: 0.01 }]);
  const build = buildPreviousRanks(history, '2026-10-13', { ok: true, source: 'artificial-analysis', rejectedRows: 0, records: aa },
    'rankings-daily:day:top50', undefined, false);
  const oldRank = baseline.orchestrator.get('deepseek-v4-flash'), inherited = build.ranks.find(r => r.metric === 'orchestrator' && r.modelId === 'deepseek-v4-1-flash');
  assert.equal(inherited?.rank, oldRank);
  assert.ok(!build.ranks.some(r => r.metric === 'orchestrator' && r.modelId === 'deepseek-v4-flash'));
  const today = computeRoleTop10([{ modelId: 'deepseek-v4-1-flash', metric: code, value: 75, priceInput: 0.3, priceOutput: 1.2 },
    { modelId: 'glm-5-3-flash', metric: code, value: 71.5, priceInput: 12, priceOutput: 12 }], { previousCohort: build.ranks });
  assert.equal(today.orchestrator.entries[0]!.change, '▲1');
  assert.ok(!today.orchestrator.exits.some(row => row.modelId === 'deepseek-v4-flash'));
});
test('previous ranks include previous-day OpenCode Data evidence like today’s candidate pool', () => {
  const idx = 'artificial_analysis_intelligence_index';
  const aa = [rec('gpt-6-1-sol', idx, 90, '2026-10-11'), rec('gpt-6-1-sol', 'price_1m_input_tokens', 1, '2026-10-11'),
    rec('gpt-6-1-sol', 'price_1m_output_tokens', 1, '2026-10-11')];
  const prevAa = { ok: true as const, source: 'artificial-analysis' as const, rejectedRows: 0, records: aa };
  const oc: Top10RecordInput[] = [{ modelId: 'mistral-large-4', value: 100, metric: 'opencode_data_tokens' }];
  const ids = (b: ReturnType<typeof buildPreviousRanks>) => b.ranks.filter(r => r.metric === 'orchestrator').map(r => r.modelId);
  const without = buildPreviousRanks(new MemoryInsightHistory(), '2026-10-12', prevAa, 'x', undefined, false);
  const withOc = buildPreviousRanks(new MemoryInsightHistory(), '2026-10-12', prevAa, 'x', undefined, false, oc);
  assert.ok(!ids(without).includes('mistral-large-4'));
  assert.ok(ids(withOc).includes('mistral-large-4')); // 1.2.1: 밴 대상(haiku) 대신 비밴 모델로 OCD 증거 편입 검증
});
test('previous cohort applies the same release rule: older dated release rows drop when releaseDate is stored', () => {
  const dated = (v: ValidatedInsightRecord, releaseDate?: string): ValidatedInsightRecord =>
    releaseDate ? { ...v, record: { ...v.record, metadata: { ...(v.record.metadata ?? {}), releaseDate } } } : v;
  const cod = 'artificial_analysis_intelligence_index', idx = 'artificial_analysis_coding_index';
  const aa = (meta: boolean) => ({ ok: true as const, source: 'artificial-analysis' as const, rejectedRows: 0, records: [
    dated(rec('deepseek-v4-pro', idx, 50, '2026-10-11'), meta ? '2026-08-13' : undefined),
    dated(rec('deepseek-v4-pro-0424', cod, 90, '2026-10-11'), meta ? '2026-04-24' : undefined),
    rec('glm-5-3-flash', cod, 60, '2026-10-11')] });
  const worker = (meta: boolean) => buildPreviousRanks(new MemoryInsightHistory(), '2026-10-12', aa(meta), 'x', undefined, false)
    .ranks.filter(r => r.metric === 'orchestrator').map(r => r.modelId);
  assert.equal(worker(false)[0], 'deepseek-v4-pro'); // 판정 불가: 구 릴리스 지수 90이 남는다
  assert.equal(worker(true)[0], 'glm-5-3-flash'); // 0424 행 제거 → 0813에는 해당 지수가 없다
});
