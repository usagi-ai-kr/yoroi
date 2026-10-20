import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseArenaCodingRow,
  parseEffortToken,
  toBaseId,
} from '../src/insights/arena-coding-parser.js';
import {
  ARENA_CODING_SCORE_METRIC,
  ARENA_CODING_SOURCE,
  ARENA_CODING_RATING_METRIC,
} from '../src/insights/arena-coding-types.js';
import { ARENA_CODING_SOURCE_ID, arenaCodingIdentityKey, arenaCodingModelId, toArenaCodingRecord } from '../src/insights/arena-coding-model.js';
import { splitBaseAndEffort } from '../src/insights/letter-top10-group.js';

const webdev = (over: Record<string, unknown> = {}) => ({ category: 'overall',
  model_name: 'Claude Opus 5.5 (Max)', organization: 'anthropic', license: 'Proprietary',
  rating: 63.31, rating_lower: 60.1, rating_upper: 66.2, variance: 1.1, vote_count: 1225,
  rank: 1, leaderboard_publish_date: '2026-10-16', ...over });
const bash = (over: Record<string, unknown> = {}) => ({ category: 'overall',
  model_name: 'Grok 4.7 (xHigh)', organization: 'xai', license: 'Proprietary',
  score: 0.14, score_ci_lower: 0.11, score_ci_upper: 0.17, observation_count: 1500,
  rank: 16, leaderboard_publish_date: '2026-10-16', ...over });

test('webdev 행을 파싱한다', () => {
  const p = parseArenaCodingRow(webdev(), 'webdev')!;
  assert.deepEqual([p.baseId, p.effort, p.metric, p.value, p.rank], ['claude-opus-5-5', 'max', ARENA_CODING_RATING_METRIC, 63.31, 1]);
  assert.equal(p.effortQualifier, undefined);
});

test('bash recovery 행을 score 체계로 파싱한다', () => {
  const p = parseArenaCodingRow(bash(), 'agent_bash_recovery_steps')!;
  assert.deepEqual([p.baseId, p.effort, p.metric, p.value, p.observations], ['grok-4-7', 'xhigh', ARENA_CODING_SCORE_METRIC, 0.14, 1500]);
});

test('음수 IPS를 그대로 보존한다', () => {
  const p = parseArenaCodingRow(bash({ score: -0.02, model_name: 'GPT-5.5' }), 'agent_bash_recovery_steps')!;
  assert.equal(p.value, -0.02);
  assert.equal(toArenaCodingRecord(p).value, -0.02);
});

test('날짜형 effort를 분리하고 병합하지 않는다', () => {
  const p = parseArenaCodingRow(webdev({ model_name: 'DeepSeek-V4-Pro (High, 20260813)' }), 'webdev')!;
  assert.deepEqual([p.baseId, p.effort, p.effortQualifier], ['deepseek-v4-pro', 'high', '20260813']);
  const plain = parseArenaCodingRow(webdev({ model_name: 'DeepSeek-V4-Pro (High)' }), 'webdev')!;
  assert.equal(plain.effortQualifier, undefined);
  assert.notEqual(arenaCodingIdentityKey(p), arenaCodingIdentityKey(plain));
});

test('aggregate·미확인·비코딩 서브셋과 결측을 버린다', () => {
  for (const subset of ['agent', 'agent_bash_reliability', 'agent_bash_reliability_no_prereq',
    'agent_tool_hallucination', 'text', 'vision', 'unknown', undefined]) {
    assert.equal(parseArenaCodingRow(webdev(), subset), undefined, String(subset));
  }
  assert.equal(parseArenaCodingRow(webdev({ rating: undefined }), 'webdev'), undefined);
  assert.equal(parseArenaCodingRow(webdev({ model_name: 'Mystery (Ultra)' }), 'webdev'), undefined);
  assert.equal(parseArenaCodingRow(null, 'webdev'), undefined);
});

test('유사 이름을 자동 병합하지 않는다', () => {
  assert.equal(toBaseId('GPT-5.5'), 'gpt-5-5');
  assert.equal(toBaseId('GPT-6 Astra'), 'gpt-6-astra');
  assert.notEqual(toBaseId('GPT-5.5'), toBaseId('GPT-6 Astra'));
  assert.equal(parseEffortToken('Muse Spark 1.1')?.effort, 'default');
});

test('저장소 행 계약과 식별키를 매핑한다', () => {
  assert.equal(ARENA_CODING_SOURCE_ID, ARENA_CODING_SOURCE);
  const p = parseArenaCodingRow(webdev(), 'webdev')!;
  assert.deepEqual(toArenaCodingRecord(p),
    { modelId: 'claude-opus-5-5-max', metric: ARENA_CODING_RATING_METRIC, value: 63.31, arenaSubset: 'webdev', arenaCategory: 'overall' });
  const d = parseArenaCodingRow(webdev({ model_name: 'GPT-5.5' }), 'webdev')!;
  assert.equal(toArenaCodingRecord(d).modelId, 'gpt-5-5');
  assert.equal(arenaCodingIdentityKey(p), 'arena-coding|webdev|overall|claude-opus-5-5|max|-');
});

test('effort 없이 날짜·하네스 한정자만 있는 행은 버리지 않는다(#190 공식 스키마 실측)', () => {
  assert.deepEqual(parseEffortToken('Qwen3.8-Max (0902)'), { effort: 'default', qualifier: '0902' });
  assert.deepEqual(parseEffortToken('Kimi K2.5 (Thinking)'), { effort: 'default', qualifier: 'thinking' });
  const p = parseArenaCodingRow(webdev({ model_name: 'Qwen3.8-Max (0902)' }), 'webdev')!;
  assert.deepEqual([p.baseId, p.effort, p.effortQualifier], ['qwen3-8-max', 'default', '0902']);
});

test('여러 괄호 묶음에서도 effort를 잃지 않는다', () => {
  assert.deepEqual(parseEffortToken('DeepSeek V4 Pro (High) (0813)'), { effort: 'high', qualifier: '0813' });
  assert.deepEqual(parseEffortToken('Claude Opus 4.5 (High, 32K, 20251101)'), { effort: 'high', qualifier: '32k,20251101' });
  assert.deepEqual(parseEffortToken('GPT-5.6 Sol (xHigh, Codex Harness)'), { effort: 'xhigh', qualifier: 'codex harness' });
});

test('한정자가 있으면 model id 에 남아 기본 모델과 series 키가 섞이지 않는다', () => {
  const dated = arenaCodingModelId({ baseId: 'qwen3.8-max', effort: 'default', effortQualifier: '0902' });
  assert.notEqual(dated, arenaCodingModelId({ baseId: 'qwen3.8-max', effort: 'default' }));
  assert.equal(splitBaseAndEffort(arenaCodingModelId({ baseId: 'deepseek-v4-pro', effort: 'high', effortQualifier: '20260813' })).effort, 'high');
});
