import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { CALIBRATION_EVALUATOR_VERSION, type CalibrationStore, type CalibrationRunRecord } from '../src/insights/calibration-store.js';
import { CALIBRATION_TASK_SET_VERSION } from '../src/insights/calibration-task-set.js';
import { openCalibrationStore } from '../src/insights/calibration-store-sqlite.js';
import { runCalibrationCli, parseCalibrationArgs } from '../src/insights/calibration-cli.js';
import type { OpenCodeFreeModel } from '../src/insights/opencode-free-models.js';
import { parseInsights } from '../src/ui/cli/insights-args.js';

class FakeRunner implements ProcessRunner {
  public runs = 0;
  async run(req: ProcessRequest): Promise<ProcessOutput> {
    this.runs++;
    const m = /Working directory:\n(\S+)/.exec(`${req.args[req.args.length - 1] ?? ''}\n${req.input ?? ''}`);
    const dir = m?.[1] ?? '', env = req.env?.CALIBRATION_TASK_ID;
    if (env === 'task-1-packet-compliance') writeFileSync(join(dir, 'report.json'), JSON.stringify({ task_id: 't1', status: 'ok', checks_passed: true }));
    else if (env === 'task-2-single-file-edit') { mkdirSync(join(dir, 'src'), { recursive: true }); writeFileSync(join(dir, 'src/target.ts'), 'val'); }
    return { stdout: 'completed successfully', stderr: '', exitCode: 0 }; }
}
class FailRunner implements ProcessRunner {
  async run(): Promise<ProcessOutput> { return { stdout: '', stderr: 'Unknown flag --dir', exitCode: 2 }; }
}
class FakeStore implements CalibrationStore {
  public saved: CalibrationRunRecord[] = [];
  saveRun(r: CalibrationRunRecord): void { this.saved.push(r); } listRuns(): CalibrationRunRecord[] { return this.saved; }
  prune(): number { return 0; } close(): void {}
}
const MODELS: readonly OpenCodeFreeModel[] = [{ provider: 'opencode', originalId: 'opencode/test-free', modelId: 'test' }];

test('arg parsing rejects invalid flags with exit 2 style and supports free subcommand and --help', async () => {
  assert.equal(parseCalibrationArgs([]).ok, false);
  assert.equal(parseCalibrationArgs(['--runs', '2', '--model', 'm']).ok, false);
  assert.equal(parseCalibrationArgs(['--model', 'm', '--unknown']).ok, false);
  assert.equal(parseCalibrationArgs(['free', '--model', 'm', '--runs', '3', '--yes']).ok, true);
  const badRunner = new FakeRunner();
  assert.equal(await runCalibrationCli(['--unknown'], { runner: badRunner }), 2);
  assert.equal(badRunner.runs, 0); assert.equal(await runCalibrationCli(['--help'], { runner: badRunner }), 0);
});

test('pre-run confirmation flow requires explicit confirmation and prints disclosures', async () => {
  const runner = new FakeRunner(), logs: string[] = [], errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'opencode/test-free'], { runner, models: MODELS, stdout: m => logs.push(m), stderr: m => errs.push(m) });
  assert.equal(code, 1); assert.equal(runner.runs, 0);
  assert.ok(logs.some(l => l.includes('쿼터 불명')) && logs.some(l => l.includes('Best-effort: turns/tokens')) && logs.some(l => l.includes('턴·토큰 상한은 미강제')), '미강제 한계를 실행 계획에도 밝힌다');
  assert.ok(errs.some(e => e.includes('pre-run confirmation required'))); });

test('launch failure exits 1 without saving scored runs', async () => {
  const store = new FakeStore(), errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'opencode/test-free', '--yes'], { runner: new FailRunner(), store, models: MODELS, stderr: m => errs.push(m) });
  assert.equal(code, 1); assert.equal(store.saved.length, 0); assert.ok(errs.some(e => e.includes('insufficient'))); });

test('rejects unverified or unlisted Free model without runner calls', async () => {
  const runner = new FakeRunner(), errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'unverified-model', '--yes'], { runner, models: MODELS, stderr: m => errs.push(m) });
  assert.equal(code, 1); assert.equal(runner.runs, 0);
  assert.ok(errs.some(e => e.includes('unverified or unlisted Free model'))); });

test('1-run provisional vs 3-run median stable saves with version constants and normalized id', async () => {
  const runner1 = new FakeRunner(), store1 = new FakeStore();
  assert.equal(await runCalibrationCli(['free', '--model', 'opencode/test-free', '--yes'], { runner: runner1, store: store1, models: MODELS }), 0);
  assert.equal(runner1.runs, 4);
  assert.equal(store1.saved[0]!.sampleStatus, 'provisional'); assert.equal(store1.saved[0]!.modelId, 'test');
  assert.equal(store1.saved[0]!.taskSetVersion, CALIBRATION_TASK_SET_VERSION); assert.equal(store1.saved[0]!.evaluatorVersion, CALIBRATION_EVALUATOR_VERSION);
  const runner3 = new FakeRunner(), store3 = new FakeStore();
  assert.equal(await runCalibrationCli(['--model', 'opencode/test-free', '--runs', '3', '--yes'], { runner: runner3, store: store3, models: MODELS }), 0);
  assert.equal(runner3.runs, 12);
  assert.equal(store3.saved[0]!.sampleStatus, 'stable'); assert.equal(store3.saved[0]!.sampleCount, 3);
});

test('fresh-DB first-run persists; file-path open fails deterministically', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'calib-cli-fresh-')); try {
    const store = openCalibrationStore({ YOROI_DATA_DIR: tempDir }), runner = new FakeRunner();
    assert.equal(await runCalibrationCli(['free', '--model', 'opencode/test-free', '--yes'], { runner, store, models: MODELS }), 0);
    assert.equal(store.listRuns('test').length, 1); store.close();
  } finally { rmSync(tempDir, { recursive: true, force: true }); }
  const blockRoot = mkdtempSync(join(tmpdir(), 'calib-cli-block-')); try {
    writeFileSync(join(blockRoot, 'file'), 'x');
    assert.throws(() => openCalibrationStore({ YOROI_DATA_DIR: join(blockRoot, 'file', 'db') }), '파일 아래 경로는 결정적으로 실패한다');
  } finally { rmSync(blockRoot, { recursive: true, force: true }); }
});

test('CLI 출력과 저장 레코드가 같은 집계 근거를 쓴다', async () => {
  const runner = new FakeRunner(), store = new FakeStore(), logs: string[] = [];
  assert.equal(await runCalibrationCli(['free', '--model', 'opencode/test-free', '--runs', '3', '--yes'], { runner, store, models: MODELS, stdout: m => logs.push(m) }), 0);
  const record = store.saved[0]!;
  assert.equal(record.samples?.length, 3);
  assert.ok(logs.some(l => l.includes(`점수: ${record.totalScore}/100`)), '출력 점수 = 저장 점수');
  assert.ok(logs.some(l => l.includes('집계: median')), '출력에 집계 방식 표시');
  for (const t of record.taskAggregates ?? []) assert.ok(logs.some(l => l.includes(`${t.taskId}: 최소 ${t.minScore}점 · 통과 ${t.passedCount}/${t.sampleCount}`)), t.taskId);
});

test('gating: non-vacuous separation between once/publish and calibrate CLI', () => {
  const err = parseInsights(['calibrate', 'free', '--model', 'opencode/test-free']);
  assert.equal(err.kind, 'error');
  assert.ok((err as { message: string }).message.includes('unexpected argument: calibrate'));
  assert.equal(parseInsights(['once']).kind, 'insights'); assert.equal(parseInsights(['publish']).kind, 'insights'); });
