import assert from 'node:assert/strict';
import test from 'node:test';
import { computeRoleTop10 } from '../src/insights/letter-top10-unified.js';
import { normalRankScores, NORMAL_SCORE_MEAN } from '../src/insights/letter-score-normal.js';
import type { Top10RecordInput } from '../src/insights/letter-top10-rank.js';

const INTEL = 'artificial_analysis_intelligence_index', CODE = 'artificial_analysis_coding_index';
const row = (modelId: string, metric: string, value: number, price?: [number, number]): Top10RecordInput =>
  ({ modelId, metric, value, ...(price && { priceInput: price[0], priceOutput: price[1] }) });
const RECORDS: readonly Top10RecordInput[] = [
  row('claude-opus-5-5', INTEL, 90, [1.5, 7]), row('claude-opus-5-5', CODE, 70, [1.5, 7]),
  row('gpt-6-1-sol', INTEL, 88, [1.1, 4.4]), row('gpt-6-1-sol', CODE, 80, [1.1, 4.4]),
  row('claude-haiku-5-5', INTEL, 86, [0.8, 4]), row('claude-haiku-5-5', CODE, 40, [0.8, 4]),
  row('gemini-3-1-pro', INTEL, 84, [1, 1]), row('gemini-3-1-pro', CODE, 60, [1, 1]),
]; // 1.2.1: haiku는 오케 밴(워커 유지)이라 오케 모집단 n=3(sol·opus·gemini)으로 중앙 50 검증
const cog = (pairs: readonly (readonly [string, number])[]) =>
  pairs.map(([modelId, value]) => ({ modelId, metric: 'cognition_correct', value }));
const W = { cognitionRecords: cog([['gpt-6-1-sol-high', 0.6], ['claude-opus-5-5-max', 0.55], ['claude-haiku-5-5-max', 0.3]]) };

test('scoreText is the normal-rank 50-centered value; raw score stays in rawScore', () => {
  const { orchestrator } = computeRoleTop10(RECORDS, W);
  const shown = orchestrator.entries.map(e => Number(e.scoreText));
  const raws = orchestrator.entries.map(e => e.rawScore!);
  // 원점수는 보존된다(비교용·zone 근거) — 기존 raw와 일치해야 한다.
  assert.ok(raws.every(v => typeof v === 'number' && Number.isFinite(v)), 'rawScore는 유한 원점수');
  // 표시 scoreText는 정규순위 50중심: 원점수와 다르고 중앙이 50 근처다.
  for (const e of orchestrator.entries) assert.notEqual(e.scoreText, e.rawScore!.toFixed(1), '표시=보정, 원점수≠표시');
  const sorted = [...shown].sort((a, b) => a - b);
  assert.ok(Math.abs(sorted[Math.floor(sorted.length / 2)]! - NORMAL_SCORE_MEAN) < 6, `중앙 50 근처, got ${sorted}`);
  // 표시 numeric과 scoreText 문자열 일치.
  for (const e of orchestrator.entries) assert.equal(Number(e.scoreText).toFixed(1), e.scoreText!);
});

test('rank order is preserved: calibrated stays monotone with raw (no re-sort by calibration)', () => {
  const { orchestrator, worker } = computeRoleTop10(RECORDS, W);
  for (const list of [orchestrator, worker]) {
    for (let i = 1; i < list.entries.length; i++) {
      const prev = list.entries[i - 1]!, cur = list.entries[i]!;
      assert.ok(prev.rawScore! >= cur.rawScore!, `순위=raw 내림차순 유지: ${prev.modelId}(${prev.rawScore}) >= ${cur.modelId}(${cur.rawScore})`);
      assert.ok(Number(prev.scoreText) >= Number(cur.scoreText), '보정도 단조(표시 순서=raw 순서)');
    }
    assert.equal(list.entries[0]!.rank, 1);
  }
});

test('worker raw components and bonus are untouched; roles calibrate independently', () => {
  const { orchestrator, worker } = computeRoleTop10(RECORDS, W);
  // 워커 원점수 components·가산 보존(보정은 scoreText만 바꾼다).
  for (const e of worker.entries) {
    assert.ok(e.scoreComponents, 'components 보존');
    assert.ok(Number.isFinite(e.rawScore!), '워커 rawScore 보존');
  }
  // 역할 독립: 각 역할 자기 모집단에서 보정 → 두 목록 점수대가 서로 섞이지 않는다.
  assert.ok(orchestrator.entries.length > 0 && worker.entries.length > 0);
  const o = orchestrator.entries.map(e => Number(e.scoreText));
  assert.ok(o.every(v => v >= 0 && v <= 100), '보정값 0..100');
});

test('calibration uses the whole eligible population, not just Top10', () => {
  // n=0 / n=1 / 상수 모집단은 helper 계약대로 처리된다(보정 보류·50).
  assert.deepEqual(normalRankScores([]), [], 'n=0 → 빈 배열');
  assert.deepEqual(normalRankScores([7]), [NORMAL_SCORE_MEAN], 'n=1 → 50');
  assert.deepEqual(normalRankScores([5, 5, 5]), [NORMAL_SCORE_MEAN, NORMAL_SCORE_MEAN, NORMAL_SCORE_MEAN], '상수 → 전부 50(분산 10 불가)');
  // 상이 점수는 0..100로 클램프, 미측정(NaN/±Inf)은 50으로 포장하지 않는다.
  const out = normalRankScores([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(out.length, 12, '전체 모집단 크기 유지(Top10 컷 전)');
  assert.ok(out.every(v => v >= 0 && v <= 100), '전부 0..100');
  const mixed = normalRankScores([NaN, Infinity, -Infinity, 1, 2, 3]);
  assert.ok(mixed.slice(0, 3).every(v => !Number.isFinite(v)), '미측정 NaN/±Inf 제외·원값 유지');
  assert.ok(mixed.slice(3).every(v => Number.isFinite(v) && v >= 0 && v <= 100), '유한 점수만 정규화');
});

test('all-invalid raw role scores render as missing, never NaN, Infinity, or fake 50', () => {
  const catalog = [{ planId: 'synthetic', planName: 'Synthetic', tier: 'paid' as const,
    models: [{ modelId: 'model-a', displayName: 'Model A', sourceUrl: 'https://synthetic.invalid', checkedOn: '2026-10-16', verified: true }, { modelId: 'model-b', displayName: 'Model B', sourceUrl: 'https://synthetic.invalid', checkedOn: '2026-10-16', verified: true }] }];
  const rows = [row('model-a', INTEL, 90, [1e308, 1e308]), row('model-b', INTEL, 80, [1, 1])];
  const lists = computeRoleTop10(rows, { catalog });
  for (const list of [lists.orchestrator, lists.worker]) for (const e of list.entries) {
    assert.equal(e.scoreText, '-', `${e.modelId}: invalid calibrated score uses missing marker`);
    assert.ok(Number.isNaN(e.rawScore), `${e.modelId}: original raw score stays available`);
  }
});
