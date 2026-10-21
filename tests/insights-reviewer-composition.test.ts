import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewerCandidates } from '../src/composition/insights-reviewer-candidates.js';
import { buildThreeRole } from '../src/composition/insights-three-role.js';
import { selectThreeRoles } from '../src/insights/letter-three-role.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';
const M = 'artificial_analysis_intelligence_index';
const row = (id: string, intel: number, spd?: number, pIn?: number, pOut?: number): Top10RecordInput[] => [
  { modelId: id, metric: M, value: intel, ...(pIn !== undefined && { priceInput: pIn }), ...(pOut !== undefined && { priceOutput: pOut }) },
  ...(spd !== undefined ? [{ modelId: id, metric: 'median_output_tokens_per_second', value: spd }] : []),
];
test('1. returns empty lists and emptyCause when input records are empty', () => {
  const res = buildReviewerCandidates({ records: [] });
  assert.equal(res.variants.length, 0); assert.equal(res.reviewer.length, 0);
  assert.ok(res.emptyCause && res.emptyCause.length > 0);
  assert.deepEqual(res.weights, { performance: 0.5, speed: 0.2, price: 0.3 });
});
test('2. full-pool (>15 variants) is preserved without top10 truncation', () => {
  const ids = ['gpt-6-1-sol', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5-6-sol', 'gpt-5-6-terra', 'gpt-5-6-luna', 'gpt-5-thinking-mini', 'claude-opus-5-5', 'claude-sonnet-5-5', 'gemini-3-1-pro', 'gemini-3-pro', 'deepseek-v4-1-flash', 'deepseek-v4-pro', 'gemma4', 'glm-5-3', 'glm-5-3-flash', 'glm-5-2', 'gpt-oss-120b', 'gpt-oss-20b', 'kimi-k3'];
  const records = ids.flatMap((id, i) => row(id, 60 + i, 50 + (i % 10) * 5, 2 + (i % 3), 4 + (i % 3)));
  const res = buildReviewerCandidates({ records });
  assert.equal(res.variants.length, 20, 'pool built fully, no cut at build');
  assert.equal(res.reviewer.length, 15, 'only catalog-accessible survive (5 superseded out)');
  assert.ok(res.excluded.every(e => e.reason === 'inaccessible-catalog'));
  assert.ok(res.excluded.some(e => e.modelId === 'gpt-5-6-sol'), 'superseded old-gen excluded with reason');
});
test('3. integration: weight override flips reviewer ranking across perf, price, and speed', () => {
  const records = [...row('claude-opus-5-5', 98, 40, 20, 40), ...row('gemini-3-1-pro', 75, 50, 0.1, 0.1), ...row('kimi-k3', 80, 150, 5, 10)];
  const p = buildReviewerCandidates({ records }, { weights: { performance: 0.8, speed: 0.1, price: 0.1 } });
  const c = buildReviewerCandidates({ records }, { weights: { performance: 0.1, speed: 0.1, price: 0.8 } });
  const s = buildReviewerCandidates({ records }, { weights: { performance: 0.1, speed: 0.8, price: 0.1 } });
  assert.equal(p.reviewer[0]!.modelId, 'claude-opus-5-5'); assert.equal(c.reviewer[0]!.modelId, 'gemini-3-1-pro'); assert.equal(s.reviewer[0]!.modelId, 'kimi-k3');
});
test('4. missing dimensions are excluded with reasons, never fabricated or passed through', () => {
  const records = [...row('glm-5-3', 85, 90, 2, 4), { modelId: 'gemma4', metric: M, value: 80, priceInput: 2, priceOutput: 4 }, { modelId: 'gpt-oss-120b', metric: M, value: 80 }];
  const res = buildReviewerCandidates({ records });
  assert.equal(res.candidates.length, 1); assert.equal(res.reviewer[0]!.modelId, 'glm-5-3'); assert.equal(res.excluded.length, 2);
  assert.ok(res.excluded.some(e => e.reason.includes('speed')) && res.excluded.some(e => e.reason.includes('price')));
});
test('5. buildThreeRole integrates reviewer full-pool, config override, and emptyCause', () => {
  const records = [...row('gpt-6-sol', 100, 50, 10, 20), ...row('claude-sonnet-5-5', 90, 40, 20, 40), ...row('gemini-3-1-pro', 75, 50, 0.5, 1.5)];
  const mockRun = { exitCode: 0 as const, publicationDate: '2026-10-20', letter: { ok: true as const, sections: [] }, sources: [], pruned: 0,
    top10: { records, openrouterRecords: [], failedSources: [], previousRanks: [] } };
  const def = buildThreeRole(true, mockRun);
  const perfFirst = buildThreeRole({ options: { reviewerPolicy: { weights: { performance: 0.8, speed: 0.1, price: 0.1 } } } }, mockRun);
  assert.equal(def?.selection?.top15.reviewer[0]?.modelId, 'gpt-6-sol', '독립 선발: orch 1위와 공유');
  assert.deepEqual(perfFirst?.selection?.top15.reviewer.map(c => c.modelId), ['gpt-6-sol', 'claude-sonnet-5-5', 'gemini-3-1-pro'], 'override는 2/3위 순서를 바꾼다');
  assert.equal(def?.selection?.top15.orchestrator[0]?.modelId, 'gpt-6-sol');
  assert.equal(perfFirst?.selection?.top15.orchestrator[0]?.modelId, 'gpt-6-sol');
  // #194 C: reviewer 파레토가 후보에서 계산되어 전달된다(점수·순위 불변).
  const ids = ['gpt-6-sol', 'claude-sonnet-5-5', 'gemini-3-1-pro'];
  const models = ids.map(id => ({ modelId: id, displayName: id, sourceUrl: 'https://x.test', checkedOn: '2026-10-20', verified: true }));
  const opt = { top10Options: { catalog: [{ planId: 'p', planName: 'P', models }] } };
  const pareto = buildReviewerCandidates({ records }, opt);
  assert.ok(pareto.reviewer.some(r => r.isPareto === true), '비지배 reviewer 후보가 표시된다');
  assert.ok(pareto.reviewer.some(r => r.isPareto === false), '지배된 후보는 표시되지 않는다');

  // Missing evidence: empty reviewer + emptyCause + excluded; no fallback to orchestrator score
  const emptyRun = { exitCode: 0 as const, publicationDate: '2026-10-20', letter: { ok: true as const, sections: [] }, sources: [], pruned: 0,
    top10: { records: [{ modelId: 'm1', metric: M, value: 90 }], openrouterRecords: [], failedSources: [], previousRanks: [] } };
  const emptyOut = buildThreeRole(true, emptyRun);
  assert.equal(emptyOut?.selection?.top15.reviewer.length, 0);
  assert.ok(emptyOut?.emptyCause && emptyOut.emptyCause.length > 0);
  assert.equal(emptyOut?.excluded?.length, 1);
});

test('6. catalog-inaccessible models are excluded with reason', () => {
  const records = [...row('k2-horizon-375b-a23b', 99, 200, 1, 2), ...row('gemma4', 60, 50, 2, 4)];
  const res = buildReviewerCandidates({ records });
  assert.ok(!res.reviewer.some(r => r.modelId.includes('k2-horizon')), 'AA-only model never reaches reviewer');
  assert.ok(res.excluded.some(e => e.modelId.includes('k2-horizon') && e.reason === 'inaccessible-catalog'));
  assert.ok(res.reviewer.some(r => r.modelId === 'gemma4'), 'catalog model flows through');
});

test('7. same base keeps only the top score (roles can share the model)', () => {
  const res = buildReviewerCandidates({ records: [...row('glm-5-3-high', 70, 60, 2, 4), ...row('glm-5-3-low', 95, 60, 2, 4)] });
  const glm = res.reviewer.filter(r => r.baseModelId === 'glm-5-3');
  assert.equal(glm.length, 1); assert.equal(glm[0]!.modelId, 'glm-5-3-low');
});

test('8. effort caps enforced under active profile, open otherwise', () => {
  const av = { activeProfile: 't', profiles: { t: { caps: { 'glm-5-3': 'high' } } } };
  const recs = [...row('glm-5-3-high', 80, 60, 2, 4), ...row('glm-5-3-xhigh', 99, 60, 2, 4),
    ...row('gemma4', 70, 60, 2, 4), ...row('gemma4-low', 71, 60, 2, 4)];
  const res = buildReviewerCandidates({ records: recs, effortAvailability: av });
  assert.ok(res.reviewer.some(r => r.modelId === 'glm-5-3-high'), 'at-cap variant passes');
  assert.ok(!res.reviewer.some(r => r.modelId === 'glm-5-3-xhigh'), 'over-cap variant excluded');
  assert.ok(res.excluded.some(e => e.modelId === 'glm-5-3-xhigh' && e.reason === 'over-effort-cap'));
  assert.ok(res.reviewer.some(r => r.modelId === 'gemma4-low') && !res.reviewer.some(r => r.modelId === 'gemma4'), 'capless: observed efforts compete, best deduped');
  assert.equal(buildReviewerCandidates({ records: recs }).reviewer.length, 2, 'no profile means no cap filtering');
});

test('9. comment Top15 shares independent winners with body Top7', () => {
  const shared = { modelId: 'glm-5-3', score: 90 };
  const sel = selectThreeRoles({ orchestrator: [shared, { modelId: 'o2', score: 80 }],
    reviewer: [shared, { modelId: 'r2', score: 70 }], worker: [{ modelId: 'w1', score: 60 }] });
  assert.ok(sel.top15.orchestrator.some(c => c.modelId === 'glm-5-3') && sel.top15.reviewer.some(c => c.modelId === 'glm-5-3'), 'Top15 overlap allowed');
  assert.deepEqual([sel.top7.orchestrator[0]?.modelId, sel.top7.reviewer[0]?.modelId], ['glm-5-3', 'glm-5-3'], 'body Top7 양쪽 1위 공유');
});
