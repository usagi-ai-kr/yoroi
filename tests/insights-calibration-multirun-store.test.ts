import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { buildCalibrationRunRecord, toRunRecord, type CalibrationRunRecord } from '../src/insights/calibration-record.js';
import type { CalibrationStore } from '../src/insights/calibration-store.js';
import { openCalibrationStore } from '../src/insights/calibration-store-sqlite.js';
import { recomputeAggregateInputs } from '../src/insights/calibration-stored-samples.js';
import { evaluateCalibration, evaluateMultiRunCalibration } from '../src/insights/calibration-scorer.js';
import { expectedVerdict } from '../src/insights/calibration-store-codec.js';
import { runCalibrationCli } from '../src/insights/calibration-cli.js';
import type { CalibrationRunResult } from '../src/insights/calibration-runner.js';
import type { CalibrationTaskResult } from '../src/insights/calibration-task-set.js';
import type { OpenCodeFreeModel } from '../src/insights/opencode-free-models.js';

const task = (taskId: string, passed: boolean, violations: CalibrationTaskResult['violationClasses'] = []): CalibrationTaskResult => ({
  taskId, rubric: { accuracy: passed, instruction_ownership: true, verification_report: true, latency_stability: true, retry: true, evidence_hallucination: true },
  latencies: { totalMs: 100 }, retryCount: 0, violationClasses: violations, claimsWithoutEvidenceCount: 0, passed });
const run = (tasks: readonly CalibrationTaskResult[]): CalibrationRunResult => ({ modelId: 'm', taskResults: tasks,
  evaluation: evaluateCalibration(tasks), rawPassedCount: tasks.filter(t => t.passed).length,
  verificationMarker: 'provisional_unknown_verification', isProvisional: true, durationMs: 1 });
const failFirst = [run([task('t1', false), task('t2', true)]), run([task('t1', true), task('t2', true)]), run([task('t1', true), task('t2', true)])];
const failLater = [run([task('t1', true), task('t2', true)]), run([task('t1', true), task('t2', false)]), run([task('t1', true), task('t2', false)])];
const build = (runs: readonly CalibrationRunResult[]): CalibrationRunRecord => buildCalibrationRunRecord({ runId: 'run-1', modelId: 'm', taskSetVersion: 'v1', evaluatorVersion: 'v2', runAt: '2026-10-20T00:00:00.000Z', runs }).record;
const withStore = (fn: (store: CalibrationStore) => void): void => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-calib-multi-')), store = openCalibrationStore({ YOROI_DATA_DIR: root });
  try { fn(store); } finally { store.close(); rmSync(root, { recursive: true, force: true }); } };
test('첫 실패→두 성공: 집계와 표본 근거가 함께 저장되고 재조회 후 같은 판정', () => {
  const record = build(failFirst);
  assert.equal(record.totalScore, 100, '중앙값(80,100,100)=100');
  assert.equal(record.aggregate?.medPassed, 2); assert.equal(record.aggregate?.kind, 'median');
  assert.deepEqual(record.taskAggregates?.map(a => [a.taskId, a.minScore, a.passedCount, a.sampleCount]), [['t1', 60, 2, 3], ['t2', 100, 3, 3]]);
  withStore(store => { store.saveRun(record); const [row] = store.listRuns('m');
    assert.equal(row?.totalScore, 100); assert.equal(row?.samples?.length, 3);
    assert.deepEqual(recomputeAggregateInputs(row!.samples!), { medScore: 100, medPassed: 2, hasCriticalViolation: false });
    assert.equal(row?.verdict, record.verdict); assert.deepEqual(row?.taskAggregates, record.taskAggregates); });
});
test('첫 성공→두 실패도 같은 방식으로 집계·보존된다', () => {
  const record = build(failLater);
  assert.equal(record.totalScore, 80);
  assert.deepEqual(record.taskAggregates?.map(a => [a.taskId, a.minScore, a.passedCount]), [['t1', 100, 3], ['t2', 60, 1]]);
  withStore(store => { store.saveRun(record); const [row] = store.listRuns('m');
    assert.equal(row?.totalScore, 80);
    assert.deepEqual(recomputeAggregateInputs(row!.samples!), { medScore: 80, medPassed: 1, hasCriticalViolation: false }); });
});
test('표본 순서 변경·중대 위반·단일 실행도 일관된다', () => {
  const forward = build(failFirst), reversed = build([...failFirst].reverse());
  assert.equal(reversed.totalScore, forward.totalScore); assert.equal(reversed.aggregate?.medPassed, forward.aggregate?.medPassed);
  assert.equal(reversed.verdict, forward.verdict); assert.deepEqual(reversed.taskAggregates, forward.taskAggregates);
  const crit = build([run([task('t1', true, ['unowned_file_modification'])]), run([task('t1', true)]), run([task('t1', true)])]);
  assert.equal(crit.aggregate?.hasCriticalViolation, true); assert.equal(crit.verdict, 'not_recommended');
  assert.deepEqual(crit.violationClasses, ['unowned_file_modification']);
  withStore(store => { store.saveRun(crit); const [row] = store.listRuns('m');
    assert.equal(row?.aggregate?.hasCriticalViolation, true); assert.equal(row?.verdict, 'not_recommended'); });
  const single = build([run([task('t1', true)])]);
  assert.equal(single.aggregate?.kind, 'single'); assert.equal(single.sampleCount, 1);
  assert.equal(single.sampleStatus, 'provisional'); assert.equal(single.totalScore, 100);
});
test('중첩 표본에도 prompt/response/tool-log/diff/자격이 저장되지 않는다', () => {
  const base = build(failFirst);
  const dirty = { ...base, samples: base.samples!.map((s, i) => i === 0 ? { ...s, prompt: 'secret prompt', response: { text: 'x' },
    toolLog: [], diff: '--- a', apiKey: 'sk-test', password: 'pw' } : s) };
  const sample = toRunRecord(dirty as unknown as Record<string, unknown>).samples?.[0] as unknown as Record<string, unknown>;
  for (const key of ['prompt', 'response', 'toolLog', 'diff', 'apiKey', 'password']) assert.ok(!(key in sample), key);
  withStore(store => { store.saveRun(dirty as unknown as CalibrationRunRecord);
    const raw = JSON.stringify(store.listRuns('m'));
    assert.ok(!raw.includes('secret prompt') && !raw.includes('sk-test')); });
});
test('위조 capable(실패 과제+totalScore 100)는 포트에서 거부된다', () => {
  const forged = { ...build(failFirst), samples: undefined, tasks: [{ taskId: 't1', score: 0, passed: false, latencyMs: 1, retryCount: 0 }],
    totalScore: 100, verdict: 'capable', sampleStatus: 'provisional', sampleCount: 1 };
  withStore(store => { assert.throws(() => store.saveRun(forged as unknown as CalibrationRunRecord), /mismatch/); });
});
test('run.evaluation 변조는 무시되고 taskResults 재계산 결과가 저장된다', () => {
  const tampered: CalibrationRunResult = { ...run([task('t1', false)]),
    evaluation: { ...evaluateCalibration([task('t1', false)]), totalScore: 100, verdict: 'capable' } };
  const record = build([tampered]);
  assert.equal(record.totalScore, 60, 'rubric 재계산(60)이 evaluation 주장(100)을 이긴다');
  assert.equal(record.verdict, 'not_recommended'); assert.equal(record.samples?.[0]?.totalScore, 60);
});
test('expectedVerdict 미러는 scorer 공개 API와 일치한다', () => {
  const sets = [[task('t1', true), task('t2', true), task('t3', true), task('t4', true)],
    [task('t1', true), task('t2', true), task('t3', false), task('t4', false)], [task('t1', false), task('t2', false)]] as const;
  for (const tasks of sets) { const ev = evaluateCalibration(tasks);
    assert.equal(expectedVerdict(ev.totalScore, ev.passedTaskCount, ev.hasCriticalViolation), ev.verdict); }
  const multi = evaluateMultiRunCalibration(failFirst.map(r => r.taskResults));
  assert.equal(expectedVerdict(multi.totalScore, multi.passedTaskCount, multi.hasCriticalViolation), multi.verdict);
});
class FakeRunner implements ProcessRunner {
  async run(_req: ProcessRequest): Promise<ProcessOutput> { return { stdout: 'ok', stderr: '', exitCode: 0 }; } }

