import assert from 'node:assert/strict';
import test from 'node:test';
import { ARENA_EVIDENCE_METRICS, buildArenaEvidenceBundle, buildCandidatePoolWithArena, mergeArenaEvidence,
  toArenaEvidenceRow, arenaEvidenceNote, arenaEvidenceOutcome } from '../src/insights/letter-arena-evidence.js';
import type { ArenaCodingRecord } from '../src/insights/arena-coding-model.js';
import { buildCandidatePool } from '../src/insights/letter-top10-candidates.js';
import { DEFAULT_LETTER_MODEL_LISTS } from '../src/insights/letter-model-lists.js';
import { EVIDENCE_METRICS } from '../src/insights/top10-policy.js';
import type { ValidatedInsightRecord } from '../src/insights/validation.js';

const arena = (over: Partial<ArenaCodingRecord> = {}): ArenaCodingRecord => ({
  modelId: 'claude-opus-5-5-max', metric: 'arena_coding_rating', value: 63.3,
  arenaSubset: 'webdev', arenaCategory: 'overall', ...over });
const existingEvidence = [{ modelId: 'gpt-6-luna', metric: 'total_tokens', value: 1234 }];
const catalog = [{ planId: 'p', planName: 'P', models: [
  { modelId: 'gpt-6-luna', displayName: 'GPT 6 Luna', sourceUrl: 'https://example.test', checkedOn: '2026-10-20', verified: true }] }];

test('근거 행 변환: 출처·지표·복합 식별 근거를 보존한다', () => {
  const row = toArenaEvidenceRow(arena({ effortQualifier: '20260813' }));
  assert.equal(row.modelId, 'claude-opus-5-5-max');
  assert.equal(row.metric, 'arena_coding_rating');
  assert.equal(row.value, 63.3);
  assert.equal(row.arenaSubset, 'webdev');
  assert.equal(row.arenaCategory, 'overall');
  assert.equal(row.effortQualifier, '20260813');
});

test('기본 꺼짐: 번들이 비고 후보 경로가 기존과 동일하다', () => {
  const bundle = buildArenaEvidenceBundle([arena()]);
  assert.equal(bundle.enabled, false);
  assert.deepEqual(bundle.rows, []);
  assert.deepEqual(bundle.attribution, []);
  const plain = buildCandidatePool([], catalog, existingEvidence, DEFAULT_LETTER_MODEL_LISTS);
  const withArena = buildCandidatePoolWithArena([], catalog, existingEvidence, DEFAULT_LETTER_MODEL_LISTS, bundle);
  assert.deepEqual(withArena.accessibleRecords.map(r => r.modelId), plain.accessibleRecords.map(r => r.modelId));
  assert.deepEqual(mergeArenaEvidence(existingEvidence, bundle), existingEvidence);
});

test('켜도 근거 정책이 등록 전이면 fail-closed로 반영하지 않는다', () => {
  const bundle = buildArenaEvidenceBundle([arena()], { enabled: true });
  assert.equal(bundle.enabled, true);
  assert.equal(bundle.policyReady, false, 'arena 지표는 근거 정책 미등록');
  assert.ok(bundle.blockedReason);
  assert.deepEqual(mergeArenaEvidence(existingEvidence, bundle), existingEvidence, '기존 근거 행 그대로');
  assert.ok((EVIDENCE_METRICS as readonly string[]).includes('total_tokens'));
  assert.ok(!(EVIDENCE_METRICS as readonly string[]).includes(ARENA_EVIDENCE_METRICS[0]));
});

test('기존 소스 행은 덮어쓰지 않고 뒤에 붙는다', () => {
  const rows = [{ ...arena(), metric: 'total_tokens', value: 1 }];
  const bundle = buildArenaEvidenceBundle(rows, { enabled: true });
  const merged = mergeArenaEvidence(existingEvidence, { ...bundle, policyReady: true });
  assert.equal(merged.length, 2);
  assert.deepEqual(merged[0], existingEvidence[0], '기존 행이 먼저 유지');
  assert.equal(merged[1]?.modelId, 'claude-opus-5-5-max');
});

test('출처 귀속은 arena 전용 문구로 분리된다', () => {
  const bundle = buildArenaEvidenceBundle([arena()], { enabled: true });
  assert.equal(bundle.attribution.length, 1);
  assert.ok(bundle.attribution[0]!.includes('Arena Coding'));
  assert.ok(bundle.attribution[0]!.includes('arena-coding'), '기존 source id와 섞이지 않는다');
});

test('유사 이름·다른 subset은 병합하지 않는다', () => {
  const bundle = buildArenaEvidenceBundle([
    arena({ modelId: 'muse-spark-1-3', arenaSubset: 'webdev' }),
    arena({ modelId: 'muse-spark-1-3', arenaSubset: 'agent_bash_recovery_steps' }),
    arena({ modelId: 'muse-spark-1-3', arenaSubset: 'webdev', effortQualifier: '20260813' })], { enabled: true });
  assert.equal(new Set(bundle.identities).size, 3, 'subset·한정자가 다르면 다른 항목');
});

test('결정성: 같은 입력은 같은 번들', () => {
  const records = [arena(), arena({ modelId: 'gpt-6-luna' })];
  assert.deepEqual(buildArenaEvidenceBundle(records, { enabled: true }), buildArenaEvidenceBundle(records, { enabled: true }));
});

test('노트는 출처를 분리해 밝히고 점수 미반영·게이트 상태를 함께 알린다', () => {
  const note = arenaEvidenceNote(buildArenaEvidenceBundle([arena()], { enabled: true }))!;
  assert.ok(note.includes('Arena 코딩 근거') && note.includes('성능 추가 근거·점수 미반영'), note);
  assert.ok(note.includes('lmarena-ai/leaderboard-dataset') && note.includes('CC-BY-4.0'), '공식 출처·라이선스 명시');
  assert.ok(note.includes('후보군 반영 보류'), '정책 게이트 상태 표기');
  assert.equal(arenaEvidenceNote({ enabled: false, policyReady: false, rows: [], attribution: [], identities: [] }), undefined);
});

test('수집 행 → 근거 번들 → 노트: 부분 수집·게이트가 그대로 반영된다', () => {
  const record: ValidatedInsightRecord = { comparisonDate: '2026-10-19', record: { source: 'arena-coding', modelId: 'm-one',
    modelAlias: 'M One (Max)', metric: 'arena_coding_rating', value: 1807.3, unit: 'score', category: 'overall',
    observedAt: '2026-10-20T00:00:00.000Z', sourceAsOf: '2026-10-19', sourceUrl: 'https://datasets-server.huggingface.co/rows',
    sourceName: 'Arena Coding (HF Leaderboard)', license: 'CC-BY-4.0', attributionText: 'Source: Arena Leaderboard Dataset (CC BY 4.0).',
    method: 'official-dataset', schemaVersion: 'arena-coding-v1', metadata: { subset: 'webdev', category: 'overall', effort: 'max' } } };
  const outcome = arenaEvidenceOutcome([record]);
  assert.equal(outcome.rowCount, 1);
  assert.ok(outcome.note?.includes('webdev') && outcome.note.includes('lmarena-ai/leaderboard-dataset'));
});
