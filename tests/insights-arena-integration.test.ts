import assert from 'node:assert/strict';
import test from 'node:test';
import { createInsightSourcePorts, INSIGHT_SOURCES } from '../src/insights/sources.js';
import { validateInsightRows } from '../src/insights/validation.js';
import { ARENA_CODING_RATING_METRIC, ARENA_CODING_SCORE_METRIC } from '../src/insights/arena-coding-types.js';
import { ARENA_CODING_REQUEST_SCOPE, ARENA_CODING_SOURCE_ID } from '../src/insights/sources-arena-coding-port.js';
import { MemoryInsightHistory } from '../src/insights/history-memory.js';

const OBSERVED_AT = '2026-10-20T00:00:00.000Z';
/** 공식 HF webdev/latest features 그대로의 행(실측 스키마). */
const webdev = (model_name: string, rating: number, idx: number) => ({ row_idx: idx, row: { model_name, organization: 'anthropic', license: 'Proprietary',
  rating, rating_lower: rating - 12, rating_upper: rating + 12, variance: 40, vote_count: 2900, rank: idx + 1,
  category: 'overall', leaderboard_publish_date: '2026-10-19' } });
/** 공식 HF agent_bash_recovery_steps/latest features 그대로의 행(session_count 는 실측 null). */
const agent = (model_name: string, score: number, idx: number) => ({ row_idx: idx, row: { model_name, organization: 'deepseek', license: 'MIT',
  score, score_ci_lower: score - 0.01, score_ci_upper: score + 0.01, observation_count: 745424, session_count: null,
  rank: idx + 1, category: 'overall', leaderboard_publish_date: '2026-10-08' } });
const payloadFor = (config: string) => config === 'webdev'
  ? { rows: [webdev('Claude Opus 5.5 (Max)', 1807.3, 0), webdev('Qwen3.8-Max (0902)', 1674.2, 1)], num_rows_total: 2 }
  : { rows: [agent('DeepSeek V4 Pro (High) (0813)', 0.0439, 0), agent('Mistral Medium 3.5', -0.2044, 1)], num_rows_total: 2 };
const portOf = (fetcher: (url: string) => Promise<unknown>) =>
  createInsightSourcePorts({} as never, () => undefined, { arenaFetcher: fetcher }).find(port => port.id === ARENA_CODING_SOURCE_ID)!;
const recordsOf = async (fetcher: (url: string) => Promise<unknown>) => {
  const port = portOf(fetcher);
  const validated = validateInsightRows('arena-coding', port.parse(await port.fetch(), OBSERVED_AT));
  assert.equal(validated.ok, true);
  return validated.ok ? validated.records : [];
};

test('공식 스키마 fixture가 두 서브셋에서 각각 지표와 값으로 파싱된다', async () => {
  const records = await recordsOf(async (url) => payloadFor(new URL(url).searchParams.get('config') ?? ''));
  assert.equal(records.length, 4, '두 서브셋 4행');
  const rating = records.find(r => r.record.metric === ARENA_CODING_RATING_METRIC)!;
  const score = records.find(r => r.record.metric === ARENA_CODING_SCORE_METRIC)!;
  assert.equal(rating.record.value, 1807.3);
  assert.equal(score.record.value, 0.0439);
  assert.ok(records.some(r => r.record.value === -0.2044), '음수 IPS 점수도 그대로');
});

test('한정자가 붙은 변형은 다른 행으로 남고 effort 접미사는 읽힌다', async () => {
  const records = await recordsOf(async (url) => payloadFor(new URL(url).searchParams.get('config') ?? ''));
  const dated = records.find(r => r.record.modelAlias === 'Qwen3.8-Max (0902)')!;
  const plain = records.find(r => r.record.modelAlias === 'Claude Opus 5.5 (Max)')!;
  assert.ok(dated.record.modelId.includes('0902'), '한정자가 model id 에 남는다');
  assert.notEqual(dated.record.modelId, 'qwen3.8-max');
  assert.ok(plain.record.modelId.endsWith('-max'), 'effort 접미사는 끝에');
  assert.equal(dated.record.metadata?.effortQualifier, '0902');
});

test('출처 귀속: 라이선스·방법·공식 링크가 그대로 붙는다', async () => {
  const records = await recordsOf(async (url) => payloadFor(new URL(url).searchParams.get('config') ?? ''));
  const record = records[0]!.record;
  assert.equal(record.source, 'arena-coding');
  assert.equal(record.license, 'CC-BY-4.0');
  assert.equal(record.method, 'official-dataset');
  assert.ok(record.attributionText.includes('lmarena-ai/leaderboard-dataset') && record.attributionText.includes('CC BY 4.0'));
  assert.equal(record.sourceAsOf, '2026-10-19', '행의 게시일이 기준일이 된다');
  assert.equal(record.schemaVersion, 'arena-coding-v1');
});

test('계통 분리: 같은 기준일이어도 다른 소스와 섞이지 않는다', async () => {
  const records = await recordsOf(async (url) => payloadFor(new URL(url).searchParams.get('config') ?? ''));
  const history = new MemoryInsightHistory();
  const key = { publicationDate: '2026-10-20', requestScope: ARENA_CODING_REQUEST_SCOPE, schemaVersion: 'arena-coding-v1', source: 'arena-coding' as const };
  const validated = validateInsightRows('arena-coding', records.map((r, index) => ({ ok: true as const, index, records: [r.record], warnings: [] })));
  assert.equal(validated.ok, true);
  assert.equal(history.saveDaily(key, validated), true);
  const back = history.getDaily(key)!;
  assert.ok(back.records.length > 0 && back.records.every(r => r.record.source === 'arena-coding'));
  assert.ok(back.records.some(r => r.record.sourceAsOf === '2026-10-08'), '서브셋별 기준일이 다르면 다른 series 로 남는다');
});

test('부분 수집·last-good: 한 서브셋 실패는 이전 정상 기록을 지우지 않는다', async () => {
  const history = new MemoryInsightHistory();
  const key = { publicationDate: '2026-10-20', requestScope: ARENA_CODING_REQUEST_SCOPE, schemaVersion: 'arena-coding-v1', source: 'arena-coding' as const };
  const ok = await recordsOf(async (url) => payloadFor(new URL(url).searchParams.get('config') ?? ''));
  const validated = validateInsightRows('arena-coding', ok.map((r, index) => ({ ok: true as const, index, records: [r.record], warnings: [] })));
  assert.equal(validated.ok, true);
  history.saveDaily(key, validated);
  const failing = await recordsOf(async (url) => {
    const config = new URL(url).searchParams.get('config') ?? '';
    if (config === 'webdev') throw new Error('hf unavailable');
    return payloadFor(config);
  });
  assert.equal(failing.length, 2, '실패한 webdev 를 제외한 agent 행만 남는다');
  assert.ok(history.getDaily(key)!.records.length === ok.length, '실패한 수집이 기존 정상 기록을 지우지 않는다');
});

test('기존 4소스 등록·동작은 그대로다', () => {
  assert.deepEqual(INSIGHT_SOURCES.map(source => source.id), ['artificial-analysis', 'openrouter', 'opencode-data', 'cognition', 'arena-coding']);
  const openrouter = createInsightSourcePorts({} as never, () => undefined, {}).find(port => port.id === 'openrouter')!;
  assert.equal(openrouter.id, 'openrouter');
});
