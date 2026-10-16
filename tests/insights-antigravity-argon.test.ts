import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAN_CATALOG } from '../src/insights/plan-catalog.js';
import { buildCandidatePool, buildRoleVariants } from '../src/insights/letter-top10-candidates.js';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { normalizeModelName, type Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const INTEL = 'artificial_analysis_intelligence_index', ARGON = 'gemini-4-argon';
const argonEntry = () => PLAN_CATALOG.find(p => p.planId === 'antigravity')!.models.find(m => m.modelId === ARGON)!;
const orArgon: Top10RecordInput = { modelId: ARGON, value: 123456, metric: 'total_tokens' };

test('#165 Argon: docs/models 근거·2026-10-16·가용성 note, 수치 한도 미공개이므로 usageLimit 없음', () => {
  const entry = argonEntry();
  assert.equal(entry.displayName, 'Gemini 4 Argon');
  assert.equal(entry.verified, true);
  assert.equal(entry.sourceUrl, 'https://antigravity.google/docs/models');
  assert.equal(entry.checkedOn, '2026-10-16');
  assert.equal(entry.usageLimit, undefined, '수치 한도 미공개 — usageLimit에 값을 지어내지 않는다');
  for (const token of ['무료·Plus 불가', 'Pro(정식 구독)', 'Ultra', 'Enterprise', 'IDE 제외'])
    assert.ok(entry.note?.includes(token), token);
  assert.equal(normalizeModelName(ARGON), ARGON, 'canonical 자체 정규화 — 신규 별칭 불필요');
});

test('AA 결측 + OR 근거행이면 Argon은 후보에 남고, 성능값 위조 없이 0점 placeholder가 된다', () => {
  const pool = buildCandidatePool([{ modelId: 'glm-5-3', value: 90, metric: INTEL }], PLAN_CATALOG, [orArgon]);
  const row = pool.accessibleRecords.find(r => r.modelId === ARGON);
  assert.ok(row, '카탈로그 verified + OR 근거행 → 접근 후보 유지');
  assert.equal(row?.metric, 'total_tokens');
  assert.equal(row?.value, 123456, 'OR 원값 보존');
  assert.ok(!pool.allRecords.some(r => r.modelId === ARGON && r.metric === INTEL), 'AA 행을 만들어 넣지 않는다');
  const v = buildRoleVariants(pool.allRecords, INTEL, { openrouterRecords: [orArgon] }).find(x => x.modelId === ARGON)!;
  assert.equal(v.value, 0);
  assert.equal(v.indexMissing, true, 'AA 결측은 indexMissing placeholder — 측정값 아님');
});

test('모집단 적격: Argon은 오케 ▽ 보충 후보, AA intel 없는 워커 진입은 불가', () => {
  const lists = computeRoleTop10([{ modelId: 'glm-5-3', value: 90, metric: INTEL }],
    { catalog: PLAN_CATALOG, openrouterRecords: [orArgon] });
  const o = lists.orchestrator.entries.find(e => e.modelId === ARGON);
  assert.ok(o, '오케: AA 결측이어도 OR 근거로 후보 유지');
  assert.equal(o?.indexMissing, true);
  assert.equal(o?.belowZone, true, '사용량 근거만으로는 존 미달 → ▽ 보충');
  assert.ok(o?.plans.includes('Antigravity'));
  assert.ok(!lists.worker.entries.some(e => e.modelId === ARGON), '워커: AA intel ≥33 필수라 결측이면 제외');
});
