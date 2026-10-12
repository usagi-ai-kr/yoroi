import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignCompetitionRanks, computeOrchestratorTop10, computeWorkerTop10, normalizeModelName,
} from '../src/insights/letter-top10-rank.js';

test('normalizeModelName strips vendor, date suffix, lowercases, and replaces dots with hyphens', () => {
  assert.equal(normalizeModelName('OpenAI/GPT-4o'), 'gpt-4o');
  assert.equal(normalizeModelName('anthropic/claude-3-5-sonnet-20241022'), 'claude-3-5-sonnet');
  assert.equal(normalizeModelName('google/gemini-1.5-pro-0806'), 'gemini-1-5-pro');
  assert.equal(normalizeModelName('meta-llama/llama-3.1-70b-instruct-2026-10-08'), 'llama-3-1-70b-instruct');
  assert.equal(normalizeModelName('claude-fable-5.1-20260831'), 'claude-fable-5-1');
  assert.equal(normalizeModelName('gpt-5.6-sol-20260709'), 'gpt-5-6-sol');
  assert.equal(normalizeModelName('claude-opus-5.5-high'), 'claude-opus-5-5-high');
  assert.equal(normalizeModelName('qwen3.8-max'), 'qwen3-8-max');
});

test('normalizeModelName preserves effort suffixes distinctly', () => {
  assert.notEqual(normalizeModelName('claude-opus-5.5'), normalizeModelName('claude-opus-5.5-high'));
  assert.notEqual(normalizeModelName('claude-opus-5-5-high'), normalizeModelName('claude-opus-5-5-xhigh'));
  assert.equal(normalizeModelName('claude-opus-5-5'), 'claude-opus-5-5');
  assert.equal(normalizeModelName('claude-opus-5-5-high'), 'claude-opus-5-5-high');
});

test('assignCompetitionRanks assigns 1, 1, 3 for ties', () => {
  const ranked = assignCompetitionRanks([
    { modelId: 'b', value: 90 }, { modelId: 'a', value: 90 }, { modelId: 'c', value: 80 },
  ]);
  assert.deepEqual(ranked.map(r => [r.item.modelId, r.rank]), [['a', 1], ['b', 1], ['c', 3]]);
});

test('computeOrchestratorTop10 handles AA ranking, Arena, OpenRouter, and changes/exits', () => {
  const current = [
    { modelId: 'claude-fable-5-1', value: 98.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'anthropic/claude-3-5-sonnet-20241022', value: 95.42, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'openai/gpt-4o-2024-10-08', value: 92.4, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'claude-opus-5-5', value: 90.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'google/gemini-1.5-pro', value: 88.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'meta-llama/llama-3.1-405b', value: 85.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'deepseek/deepseek-r1', value: 84.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'qwen3-8-max', value: 83.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'mistral/mistral-large', value: 82.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'openai/o1-mini', value: 81.0, metric: 'artificial_analysis_intelligence_index' },
    { modelId: 'fallback/ignored-11th', value: 70.0, metric: 'artificial_analysis_intelligence_index' },
  ];
  const arena = [
    { modelId: 'gpt-4o', value: 1300, metric: 'rating' }, { modelId: 'claude-3-5-sonnet', value: 1290, metric: 'rating' },
    { modelId: 'claude-opus-5.5-high', value: 1280, metric: 'rating' },
    { modelId: 'dup-1/collision-model', value: 1250, metric: 'rating' }, // ambiguous collision
    { modelId: 'dup-2/collision-model', value: 1240, metric: 'rating' },
  ];
  const openrouter = [
    { modelId: 'claude-fable-5.1-20260831', value: 6000, metric: 'total_tokens' },
    { modelId: 'claude-3-5-sonnet', value: 5000, metric: 'total_tokens' },
    { modelId: 'deepseek-r1', value: 4000, metric: 'total_tokens' },
    { modelId: 'qwen3.8-max', value: 3000, metric: 'total_tokens' },
  ];

  // 1. Initial snapshot with dot-normalization matches, effort separation, ambiguous handling
  const initial = computeOrchestratorTop10(current, { arenaRecords: arena, openrouterRecords: openrouter });
  assert.equal(initial.entries.length, 10);
  assert.equal(initial.entries[0]?.modelId, 'claude-fable-5-1');
  assert.equal(initial.entries[0]?.openrouterRankText, 'OpenRouter 1위');
  assert.equal(initial.entries[1]?.arenaRankText, 'Arena 2위');
  assert.equal(initial.entries[1]?.openrouterRankText, 'OpenRouter 2위');
  assert.equal(initial.entries[2]?.arenaRankText, 'Arena 1위');
  assert.equal(initial.entries[3]?.arenaRankText, 'Arena -'); // claude-opus-5-5 != claude-opus-5.5-high
  assert.equal(initial.entries[7]?.openrouterRankText, 'OpenRouter 4위'); // qwen3.8-max -> qwen3-8-max
  assert.ok(initial.entries.every(e => e.change === '신규'));
  // 2. Ambiguous collision verification
  const amb = computeOrchestratorTop10([{ modelId: 'collision-model', value: 100 }], { arenaRecords: arena });
  assert.equal(amb.entries[0]?.arenaRankText, 'Arena -');
  // 3. Previous snapshot tracking
  const previous = [
    { modelId: 'openai/gpt-4o-2024-10-08', rank: 1 }, { modelId: 'claude-fable-5-1', rank: 2 }, { modelId: 'old-top-model', rank: 4 },
  ];
  const next = computeOrchestratorTop10(current, { previousCohort: previous });
  assert.equal(next.entries[0]?.change, '▲1');
  assert.equal(next.entries[2]?.change, '▼2');
  assert.deepEqual(next.exits, [{ modelId: 'old-top-model', previousRank: 4, text: '이탈: old-top-model(전일 4위)' }]);
});

test('computeWorkerTop10 ranks AA coding_index and attaches reference ranks', () => {
  const current = Array.from({ length: 12 }, (_, i) => ({
    modelId: `provider/model-${i + 1}`, value: 100 - i * 5, metric: 'artificial_analysis_coding_index',
  }));
  const arena = [{ modelId: 'model-1', rank: 1 }], or = [{ modelId: 'model-1', rank: 2 }, { modelId: 'model-2', rank: 1 }];
  const previous = [{ modelId: 'provider/model-1', rank: 1 }, { modelId: 'old-worker', rank: 10 }];
  const res = computeWorkerTop10(current, { arenaRecords: arena, openrouterRecords: or, previousCohort: previous });
  assert.equal(res.entries.length, 10);
  assert.equal(res.entries[0]?.modelId, 'provider/model-1');
  assert.equal(res.entries[0]?.arenaRankText, 'Arena 1위');
  assert.equal(res.entries[0]?.openrouterRankText, 'OpenRouter 2위');
  assert.equal(res.entries[1]?.arenaRankText, 'Arena -');
  assert.equal(res.entries[1]?.openrouterRankText, 'OpenRouter 1위');
  assert.equal(res.entries[0]?.change, '유지');
  assert.equal(res.entries[1]?.change, '진입');
  assert.deepEqual(res.exits, [{ modelId: 'old-worker', previousRank: 10, text: '이탈: old-worker(전일 10위)' }]);
});
