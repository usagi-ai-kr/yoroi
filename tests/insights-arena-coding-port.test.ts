import assert from 'node:assert/strict';
import test from 'node:test';
import { INSIGHT_SOURCES, createInsightSourcePorts } from '../src/insights/sources.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS, RANK_COHORTS } from '../src/insights/run-once-steps.js';
import { validateInsightRows } from '../src/insights/validation.js';
import { ARENA_CODING_RATING_METRIC, ARENA_CODING_SCORE_METRIC } from '../src/insights/arena-coding-types.js';
import { ARENA_CODING_REQUEST_SCOPE, ARENA_CODING_SOURCE_ID, ARENA_CODING_URL } from '../src/insights/sources-arena-coding-port.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';

const OBSERVED_AT = '2026-10-20T00:00:00.000Z';
const row = (model_name: string, value: number, metric: 'rating' | 'score', over: Record<string, unknown> = {}) => ({ row_idx: 0, row: { model_name, category: 'overall', ...(metric === 'rating' ? { rating: value } : { score: value }), rank: 1, leaderboard_publish_date: '2026-10-16', ...over } });
const fetcherFor = (failing?: string, total = 1) => async (url: string): Promise<unknown> => {
  const config = new URL(url).searchParams.get('config') ?? '';
  if (failing !== undefined && config === failing) throw new Error('boom');
  const web = config === 'webdev';
  return { rows: [row(web ? 'Claude Opus 5.5 (Max)' : 'Grok 4.7 (xHigh)', web ? 63.3 : 0.14, web ? 'rating' : 'score')], num_rows_total: total };
};
const portOf = (fetcher?: (url: string) => Promise<unknown>) => createInsightSourcePorts({} as never, () => undefined, { ...(fetcher && { arenaFetcher: fetcher }) }).find(port => port.id === ARENA_CODING_SOURCE_ID)!;

test('소스 등록: arena-coding이 1급 소스로 등록되고 기존 소스 동작은 그대로다', () => {
  const entry = INSIGHT_SOURCES.find(source => source.id === 'arena-coding')!;
  assert.deepEqual([entry.url, entry.license, entry.auth, entry.authEnvName, entry.pipeline], [ARENA_CODING_URL, 'CC-BY-4.0', 'none', null, 'arena-rows']);
  assert.ok(entry.displayName.length > 0 && entry.note.length > 0);
  assert.deepEqual(INSIGHT_SOURCES.map(source => source.id), ['artificial-analysis', 'openrouter', 'opencode-data', 'cognition', 'arena-coding']);
  assert.equal(DEFAULT_SCHEMA_VERSIONS['arena-coding'], 'arena-coding-v1');
  assert.equal(DEFAULT_REQUEST_SCOPES['arena-coding'], ARENA_CODING_REQUEST_SCOPE);
  assert.equal(RANK_COHORTS['arena-coding']!.metric, ARENA_CODING_RATING_METRIC);
});

test('URL·파라미터: dataset/config/split/offset/length가 dataset+config로 전송된다', async () => {
  const calls: string[] = [];
  const port = portOf(async url => { calls.push(url); return { rows: [row('M (Max)', 50, 'rating')], num_rows_total: 1 }; });
  await port.fetch();
  for (const url of calls) {
    const params = new URL(url).searchParams;
    assert.deepEqual([params.get('dataset'), params.get('split'), params.get('offset')], ['lmarena-ai/leaderboard-dataset', 'latest', '0']);
    assert.ok(Number(params.get('length')) > 0 && ['webdev', 'agent_bash_recovery_steps'].includes(params.get('config') ?? ''));
  }
  assert.ok(calls.length >= 2, '두 서브셋을 요청한다');
});

test('두 서브셋 수집·매핑: 소스·지표·출처가 채워진다', async () => {
  const port = portOf(fetcherFor());
  const validated = validateInsightRows('arena-coding', port.parse(await port.fetch(), OBSERVED_AT));
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  const records = validated.records.map(entry => entry.record);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(record => record.metric).sort(), [ARENA_CODING_RATING_METRIC, ARENA_CODING_SCORE_METRIC]);
  for (const record of records) {
    assert.deepEqual([record.source, record.sourceAsOf, record.sourceUrl, record.license, record.method, record.observedAt],
      ['arena-coding', '2026-10-16', ARENA_CODING_URL, 'CC-BY-4.0', 'official-dataset', OBSERVED_AT]);
    assert.ok(record.attributionText.includes('CC BY 4.0'));
  }
});

test('한 서브셋 실패 격리: 실패 진단이 남고 다른 서브셋 행은 살아 있다', async () => {
  const port = portOf(fetcherFor('webdev'));
  const rows = port.parse(await port.fetch(), OBSERVED_AT);
  const validated = validateInsightRows('arena-coding', rows);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  assert.equal(validated.records.length, 1, '실패한 webdev를 제외한 agent 행만');
  assert.equal(validated.records[0]!.record.metric, ARENA_CODING_SCORE_METRIC);
  assert.equal(validated.rejectedRows, 1, '실패 서브셋은 거부 행으로 집계된다');
});

test('교차 소스 혼합 없음: arena-coding 행이 다른 소스로 승격되지 않는다', async () => {
  const port = portOf(fetcherFor());
  const rows = port.parse(await port.fetch(), OBSERVED_AT);
  const other = validateInsightRows('openrouter', rows);
  assert.equal(other.ok, false, '다른 소스로는 승격되지 않는다');
});

test('진단 행: 발행일 없는 행과 에러 없는 부분 수집이 집계된다', async () => {
  const nodate = portOf(async () => ({ rows: [{ row_idx: 0, row: { model_name: 'M (Max)', category: 'overall', rating: 50, rank: 1 } }], num_rows_total: 1 }));
  const nodateRows = nodate.parse(await nodate.fetch(), OBSERVED_AT);
  assert.ok(nodateRows.some(r => !r.ok && r.reason.includes('missing leaderboard_publish_date')));
  assert.equal(validateInsightRows('arena-coding', nodateRows).rejectedRows, 1);
  const partial = portOf(async () => ({ rows: [row('M (Max)', 50, 'rating')], num_rows_total: 5 }));
  const partialRows = partial.parse(await partial.fetch(), OBSERVED_AT);
  assert.ok(partialRows.some(r => !r.ok && r.reason.includes('partial subset')));
  assert.equal(validateInsightRows('arena-coding', partialRows).rejectedRows, 2, '두 서브셋 모두 부분');
});

test('계통 분리: arena-coding 저장·조회는 arena overall와 섞이지 않는다', async () => {
  const port = portOf(fetcherFor());
  const coding = validateInsightRows('arena-coding', port.parse(await port.fetch(), OBSERVED_AT));
  assert.equal(coding.ok, true);
  const history = new MemoryInsightHistory();
  const key = { publicationDate: '2026-10-20', requestScope: 's', schemaVersion: 'arena-coding-v1', source: 'arena-coding' as const };
  assert.equal(history.saveDaily(key, coding), true);
  const back = history.getDaily(key)!;
  assert.ok(back.records.length > 0 && back.records.every(r => r.record.source === 'arena-coding'));
  const legacyLike = JSON.parse(JSON.stringify({ ...coding.records[0]!.record, source: 'arena', category: 'overall' }));
  const mixed = validateInsightRows('arena-coding', [{ ok: true, index: 0, records: [coding.records[0]!.record], warnings: [] }, { ok: true, index: 1, records: [legacyLike], warnings: [] }]);
  assert.equal(mixed.ok, true);
  assert.equal(mixed.rejectedRows, 1);
  assert.ok(mixed.records.every(r => r.record.source === 'arena-coding'));
});
