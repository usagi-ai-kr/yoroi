import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_LETTER_MODEL_LISTS, loadLetterModelLists } from '../src/insights/letter-model-lists.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import type { PlanCatalogEntry } from '../src/insights/plan-catalog.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
import { buildTeamCombinations } from '../src/insights/letter-team-combinations.js';
import { runThreeRolePipeline } from '../src/insights/letter-three-role-pipeline.js';

/** #266 blacklist: glm-5-3·kimi-k3 정확히 제외, flash 유지, 전 경로 배제. */
const INTEL = 'artificial_analysis_intelligence_index';
const catalogFor = (ids: readonly string[]): readonly PlanCatalogEntry[] => [{ planId: 't', planName: 'T',
  models: ids.map(modelId => ({ modelId, displayName: modelId, sourceUrl: 'https://example.test', checkedOn: '2026-10-16', verified: true })) }];
const row = (modelId: string, value: number): Top10RecordInput => ({ modelId, metric: INTEL, value });
const cand = (modelId: string, score?: number, free?: boolean) => ({ modelId, baseModelId: modelId, identityKey: modelId,
  ...(score !== undefined && { score }), ...(free === true && { free }) });
const BANNED = new Set(['glm-5-3', 'kimi-k3', 'mimo-v2-6-pro']);

test('설정 파일의 공통 blacklist는 3종 정확히', () => {
  assert.deepEqual(loadLetterModelLists().ban.common, ['glm-5-3', 'kimi-k3', 'mimo-v2-6-pro']);
});

test('Top10 양 역할에서 제외·flash 유지·타 점수 불변', () => {
  const ids = ['alpha', 'glm-5-3', 'kimi-k3', 'mimo-v2-6-pro', 'glm-5-3-flash', 'beta'];
  const records = [row('alpha', 90), row('glm-5-3', 85), row('kimi-k3', 84), row('mimo-v2-6-pro', 83), row('glm-5-3-flash', 75), row('beta', 70)];
  const clean = { ...DEFAULT_LETTER_MODEL_LISTS, ban: { common: [], orchestrator: [], worker: [] } };
  const base = computeRoleTop10(records, { catalog: catalogFor(ids), letterModelLists: clean });
  const banned = computeRoleTop10(records, { catalog: catalogFor(ids), letterModelLists: DEFAULT_LETTER_MODEL_LISTS });
  for (const role of ['orchestrator', 'worker'] as const) {
    assert.ok(!banned[role].entries.some(e => e.modelId === 'glm-5-3' || e.modelId === 'kimi-k3'), `${role} 제외`);
    assert.ok(banned[role].entries.some(e => e.modelId === 'glm-5-3-flash'), `${role} flash 유지`);
    for (const id of ['alpha', 'beta', 'glm-5-3-flash'])
      assert.equal(banned[role].entries.find(e => e.modelId === id)?.scoreText, base[role].entries.find(e => e.modelId === id)?.scoreText, `${role} ${id} 점수 불변`);
  }
});

test('조합·차선·fallback에서 제외, 쿼터는 타 Free로 유지', () => {
  const top = { orchestrator: [cand('gpt-6-sol', 90), cand('glm-5-3', 85)], reviewer: [cand('kimi-k3', 0.9), cand('r1', 0.8)],
    worker: [cand('w1', 70), cand('glm-5-3', 53), cand('mimo-v2-6-flash', 58)] };
  const union = { o: [cand('deepseek-v4-1-flash', 90), cand('gpt-6-sol', 88)], r: [cand('r1', 0.8), cand('kimi-k3', 0.9)], w: [...top.worker, cand('deepseek-v4-1-flash', 57)] };
  const combos = buildTeamCombinations({ top15: top, unionPool: union,
    verifiedFreeKeys: new Set(['mimo-v2-6-flash']), bannedKeys: BANNED, freeWorkerFallback: [cand('beam-free', undefined, true)] });
  assert.equal(combos.length, 4);
  for (const combo of combos) {
    assert.ok(combo.slots.every(s => s.modelId !== 'glm-5-3' && s.modelId !== 'kimi-k3'), `${combo.key} 슬롯 제외`);
    for (const v of Object.values(combo.runnersUp))
      assert.ok(!(v !== null && typeof v === 'object' && 'modelId' in v && BANNED.has((v as { modelId: string }).modelId)), `${combo.key} 차선 제외`);
  }
  const open113 = combos.find(c => c.key === 'open-1+1+3')!;
  assert.equal(open113.feasible, true, '타 Free(mimo)로 쿼터 유지');
  assert.ok(open113.slots.some(s => s.role === 'worker' && s.modelId === 'mimo-v2-6-flash'));
});

test('파이프라인 입력 단계에서 역할·fallback·union 모두 제외', () => {
  const res = runThreeRolePipeline({ orchestrator: [cand('gpt-6-sol', 90), cand('glm-5-3', 85)],
    reviewer: [cand('kimi-k3', 80), cand('r1', 70)], worker: [cand('w1', 60), cand('glm-5-3-flash', 55)],
    freeWorkerFallback: [cand('glm-5-3-free', undefined, true)], freeCatalogModelIds: ['glm-5-3-flash-free', 'beam-free'], options: { enabled: true } });
  const sel = res.selection!;
  for (const role of ['orchestrator', 'reviewer', 'worker'] as const)
    assert.ok(sel.top15[role].every(c => c.modelId !== 'glm-5-3' && c.modelId !== 'kimi-k3'), `top15 ${role} 제외`);
  assert.ok(sel.top15.worker.some(c => c.modelId === 'glm-5-3-flash'), 'flash 유지');
  for (const combo of res.sections!.combinations!) {
    const stripped = combo.split('glm-5-3-flash').join('');
    assert.ok(!stripped.includes('glm-5-3') && !stripped.includes('kimi-k3'), '조합 출력에 금지 모델 없음');
  }
});
