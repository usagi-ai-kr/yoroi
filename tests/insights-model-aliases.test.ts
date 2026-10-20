import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCandidatePool, plansForCatalogModel } from '../src/insights/letter-top10-candidates.js';
import { buildCanonicalAliases, MODEL_ALIAS_RULES, resolveModelId } from '../src/insights/model-aliases.js';
import { normalizeModelName } from '../src/insights/model-id.js';
import { PLAN_CATALOG, type PlanCatalogEntry } from '../src/insights/plan-catalog.js';

const METRIC = 'artificial_analysis_coding_index';
const stepCatalog: PlanCatalogEntry[] = [{ planId: 'p', planName: 'P', models: [{ modelId: 'step-5', displayName: 'Step 5',
  sourceUrl: 'https://example.invalid', checkedOn: '2026-10-13', verified: true }] }];

test('(A) 규칙 통일 6건: nvidia·claude·gemma + AA alias 보조 키', () => {
  assert.equal(normalizeModelName('nvidia-nemotron-3-ultra-550b-a55b'), normalizeModelName('nemotron-3-ultra-550b-a55b'));
  assert.equal(normalizeModelName('claude-4-6-sonnet'), 'claude-sonnet-4-6');
  assert.equal(normalizeModelName('claude-4-8-opus'), 'claude-opus-4-8');
  assert.equal(normalizeModelName('gemma-4-31b-it'), 'gemma-4-31b');
  const universe = new Set(['step-5', 'glm-5-3']);
  const aliases = buildCanonicalAliases([{ modelId: 'step-5', modelAlias: 'Step 5 Preview' },
    { modelId: 'glm-5-3', modelAlias: 'GLM-5.3 (High)' }], universe);
  assert.equal(resolveModelId('step-5-preview', aliases, universe), 'step-5'); // 괄호 제거 보조 키
  assert.equal(resolveModelId('glm-5-3', aliases, universe), 'glm-5-3'); // universe와 겹치는 키는 미사용
});

test('(A1) 보조 키 충돌·비유일이면 쓰지 않는다', () => {
  const collision = buildCanonicalAliases([{ modelId: 'aa-a', modelAlias: 'X Preview' }, { modelId: 'aa-b', modelAlias: 'X Preview' }],
    new Set(['aa-a', 'aa-b']));
  assert.equal(resolveModelId('x-preview', collision, new Set(['aa-a', 'aa-b'])), 'x-preview');
  const occupied = buildCanonicalAliases([{ modelId: 'aa-a', modelAlias: 'Y Preview' }], new Set(['aa-a', 'y-preview']));
  assert.equal(resolveModelId('y-preview', occupied, new Set(['aa-a', 'y-preview'])), 'y-preview');
});

test('(B) 검증된 별칭 2건과 "대상 id가 정확히 있으면 무시" 규칙', () => {
  const universe = new Set(['muse-spark-1-3', 'mistral-large-4']);
  assert.equal(resolveModelId('muse-spark-1-3-contributor', new Map(), universe), 'muse-spark-1-3');
  assert.equal(resolveModelId('mistral-large-4-0', new Map(), universe), 'mistral-large-4');
  assert.equal(resolveModelId('muse-spark-1-3-contributor', new Map(), new Set(['muse-spark-1-3-contributor'])),
    'muse-spark-1-3-contributor'); // GA·정확 id가 생기면 별칭 자동 무시
  assert.ok(MODEL_ALIAS_RULES.every(r => ['2026-10-13', '2026-10-15', '2026-10-16', '2026-10-20'].includes(r.checkedOn) && r.basis.length > 0));
  const mini = MODEL_ALIAS_RULES.find(r => r.from === 'minimax-m3-1-flash-free')!;
  assert.equal(mini.to, 'minimax-m3-1-flash');
  assert.equal(mini.checkedOn, '2026-10-20');
  assert.match(mini.sourceUrl ?? '', /^https:\/\//);
});

test('p29b URL 검증 3건: to는 정규화 키와 일치하고 GA가 생기면 무시된다', () => {
  const aa = new Set(['nemotron-3-super-120b-a12b', 'nemotron-3-ultra-550b-a55b', 'gemini-3-1-pro-preview']);
  assert.equal(normalizeModelName('nvidia-nemotron-3-super-120b-a12b'), 'nemotron-3-super-120b-a12b');
  assert.equal(normalizeModelName('nvidia-nemotron-3-ultra-550b-a55b'), 'nemotron-3-ultra-550b-a55b');
  assert.equal(resolveModelId('nemotron-3-super', new Map(), aa), 'nemotron-3-super-120b-a12b');
  assert.equal(resolveModelId('nemotron-3-ultra', new Map(), aa), 'nemotron-3-ultra-550b-a55b');
  assert.equal(resolveModelId('gemini-3-1-pro', new Map(), aa), 'gemini-3-1-pro-preview');
  const ga = new Set([...aa, 'gemini-3-1-pro']); // AA에 정식판 GA가 생기면 별칭 무시
  assert.equal(resolveModelId('gemini-3-1-pro', new Map(), ga), 'gemini-3-1-pro');
  for (const from of ['nemotron-3-super', 'nemotron-3-ultra', 'gemini-3-1-pro']) {
    const rule = MODEL_ALIAS_RULES.find(r => r.from === from)!;
    assert.equal(rule.to, normalizeModelName(rule.from === 'gemini-3-1-pro' ? rule.to : `nvidia-${rule.to}`));
    assert.match(rule.sourceUrl ?? '', /^https:\/\//);
  }
});

test('(B 통합) 근거 행이 별칭으로 합쳐져도 AA Top10 풀은 그대로다', () => {
  const pool = buildCandidatePool([{ modelId: 'muse-spark-1-3', value: 80, metric: METRIC }], PLAN_CATALOG,
    [{ modelId: 'meta/muse-spark-1.3-contributor-20260902', value: 90, metric: 'total_tokens' }]);
  assert.deepEqual([...new Set(pool.allRecords.map(r => r.modelId))], ['muse-spark-1-3']);
  const step = buildCandidatePool([{ modelId: 'step-5', value: 70, metric: METRIC, modelAlias: 'Step 5 Preview' }], stepCatalog,
    [{ modelId: 'step-5-preview', value: 60, metric: 'opencode_data_tokens' }]);
  assert.deepEqual([...new Set(step.allRecords.map(r => r.modelId))], ['step-5']);
});

test('p29c 배선: 카탈로그 nemotron-3-ultra·gemini-3-1-pro가 AA 기록과 매칭돼 풀·라벨에 들어간다', () => {
  const catalog: PlanCatalogEntry[] = [{ planId: 'p', planName: 'P', models: [
    { modelId: 'nemotron-3-ultra', displayName: 'Nemotron 3 Ultra', sourceUrl: 'https://ollama.com/library/nemotron-3-ultra', checkedOn: '2026-10-13', verified: true },
    { modelId: 'gemini-3-1-pro', displayName: 'Gemini 3.1 Pro', sourceUrl: 'https://ai.google.dev/gemini-api/docs/models', checkedOn: '2026-10-13', verified: true }] }];
  const pool = buildCandidatePool([{ modelId: 'nvidia-nemotron-3-ultra-550b-a55b', value: 40, metric: METRIC },
    { modelId: 'gemini-3-1-pro-preview', value: 90, metric: METRIC }], catalog);
  assert.deepEqual(pool.accessibleRecords.map(r => r.modelId).sort(), ['gemini-3-1-pro', 'nemotron-3-ultra']); // 카탈로그 표시 id로 정규화
  assert.deepEqual(plansForCatalogModel('nemotron-3-ultra-550b-a55b', catalog), ['P']);
  assert.deepEqual(plansForCatalogModel('gemini-3-1-pro-preview', catalog), ['P']);
});

test('(C) 8건은 통일하지 않는다(다른 제품·체크포인트·크기 미상)', () => {
  const pairs: readonly (readonly [string, string])[] = [['gpt-6-luna-pro', 'gpt-6-luna'], ['glm-5-3-flashx', 'glm-5-3-flash'],
    ['qwen3-8-flash', 'qwen3-8-flash-next'], ['deepseek-v4-flash-vision-exp', 'deepseek-v4-flash-vision'],
    ['gemini-3-1-flash-lite', 'gemini-3-1-flash-lite-preview'], ['gemma4', 'gemma-4-31b'],
    ['ling-3-0-flash-fin', 'ling-3-0-flash-sante'], ['nemotron-3-nano-30b-a3b', 'nemotron-3-nano-omni-30b-a3b']];
  for (const [a, b] of pairs) assert.notEqual(normalizeModelName(a), normalizeModelName(b), `${a} ↔ ${b}`);
});
