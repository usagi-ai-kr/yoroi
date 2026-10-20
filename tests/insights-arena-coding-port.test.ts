import assert from 'node:assert/strict';
import test from 'node:test';
import { INSIGHT_SOURCES, createInsightSourcePorts } from '../src/insights/sources.js';
import { DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS, RANK_COHORTS } from '../src/insights/run-once-steps.js';
import { validateInsightRows } from '../src/insights/validation.js';
import { ARENA_CODING_RATING_METRIC, ARENA_CODING_SCORE_METRIC } from '../src/insights/arena-coding-types.js';
import { ARENA_CODING_REQUEST_SCOPE, ARENA_CODING_SOURCE_ID, ARENA_CODING_URL } from '../src/insights/sources-arena-coding-port.js';

const OBSERVED_AT = '2026-10-20T00:00:00.000Z';
const webRow = (id: string, rating: number) => ({ row_idx: 0, row: {
  model_name: id, category: 'overall', rating, rank: 1, leaderboard_publish_date: '2026-10-16' } });
const agentRow = (id: string, score: number) => ({ row_idx: 0, row: {
  model_name: id, category: 'overall', score, rank: 2, leaderboard_publish_date: '2026-10-16' } });
/** 서브셋별 페이로드. 실패 시 throw → 부분 수집. */
const fetcherFor = (failing?: string) => async (url: string): Promise<unknown> => {
  const config = new URL(url).searchParams.get('config') ?? '';
  if (failing !== undefined && config === failing) throw new Error('boom');
  return config === 'webdev'
    ? { rows: [webRow('Claude Opus 5.5 (Max)', 63.3)], num_rows_total: 1 }
    : { rows: [agentRow('Grok 4.7 (xHigh)', 0.14)], num_rows_total: 1 };
};
const portOf = (fetcher?: (url: string) => Promise<unknown>) =>
  createInsightSourcePorts({} as never, () => undefined, { ...(fetcher && { arenaFetcher: fetcher }) })
    .find(port => port.id === ARENA_CODING_SOURCE_ID)!;

test('소스 등록: arena-coding이 1급 소스로 등록되고 기존 소스 동작은 그대로다', () => {
  const entry = INSIGHT_SOURCES.find(source => source.id === 'arena-coding');
  assert.ok(entry, 'arena-coding 항목 존재');
  assert.equal(entry!.url, ARENA_CODING_URL);
  assert.equal(entry!.license, 'CC-BY-4.0');
  assert.equal(entry!.auth, 'none'); assert.equal(entry!.authEnvName, null);
  assert.equal(entry!.pipeline, 'arena-rows');
  assert.ok(entry!.displayName.length > 0 && entry!.note.length > 0);
  assert.deepEqual(INSIGHT_SOURCES.map(source => source.id), ['artificial-analysis', 'openrouter', 'opencode-data', 'cognition', 'arena-coding']);
  assert.equal(DEFAULT_SCHEMA_VERSIONS['arena-coding'], 'arena-coding-v1');
  assert.equal(DEFAULT_REQUEST_SCOPES['arena-coding'], ARENA_CODING_REQUEST_SCOPE);
  assert.equal(RANK_COHORTS['arena-coding']!.metric, ARENA_CODING_RATING_METRIC);
});

test('URL·파라미터: dataset/config/split/offset/length가 dataset+config로 전송된다', async () => {
  const calls: string[] = [];
  const port = portOf(async url => { calls.push(url); return { rows: [webRow('M (Max)', 50)], num_rows_total: 1 }; });
  await port.fetch();
  for (const url of calls) {
    const params = new URL(url).searchParams;
    assert.equal(params.get('dataset'), 'lmarena-ai/leaderboard-dataset');
    assert.equal(params.get('split'), 'latest');
    assert.equal(params.get('offset'), '0');
    assert.ok(Number(params.get('length')) > 0);
    assert.ok(['webdev', 'agent_bash_recovery_steps'].includes(params.get('config') ?? ''));
  }
  assert.ok(calls.length >= 2, '두 서브셋을 요청한다');
});

test('두 서브셋 수집·매핑: 소스·지표·출처가 채워진다', async () => {
  const port = portOf(fetcherFor());
  const rows = port.parse(await port.fetch(), OBSERVED_AT);
  const validated = validateInsightRows('arena-coding', rows);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;
  const records = validated.records.map(entry => entry.record);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map(record => record.metric).sort(), [ARENA_CODING_RATING_METRIC, ARENA_CODING_SCORE_METRIC]);
  for (const record of records) {
    assert.equal(record.source, 'arena-coding');
    assert.equal(record.sourceAsOf, '2026-10-16');
    assert.equal(record.sourceUrl, ARENA_CODING_URL);
    assert.equal(record.license, 'CC-BY-4.0');
    assert.equal(record.method, 'official-dataset');
    assert.ok(record.attributionText.includes('CC BY 4.0'));
    assert.equal(record.observedAt, OBSERVED_AT);
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
