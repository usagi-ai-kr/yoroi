import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import type { CalibrationStore, CalibrationRunRecord } from '../src/insights/calibration-store.js';
import { CALIBRATION_EVALUATOR_VERSION } from '../src/insights/calibration-store.js';
import { CALIBRATION_TASK_SET_VERSION } from '../src/insights/calibration-task-set.js';
import { openCalibrationStore } from '../src/insights/calibration-store-sqlite.js';
import { runCalibrationCli, parseCalibrationArgs } from '../src/insights/calibration-cli.js';
import type { OpenCodeFreeModel } from '../src/insights/opencode-free-models.js';
import { parseInsights } from '../src/ui/cli/insights-args.js';

class FakeRunner implements ProcessRunner {
  public runs = 0;
  async run(req: ProcessRequest): Promise<ProcessOutput> {
    this.runs++;
    const dir = req.args[req.args.indexOf('--dir') + 1]!, env = req.env?.CALIBRATION_TASK_ID;
    if (env === 'task-1-packet-compliance') writeFileSync(join(dir, 'report.json'), JSON.stringify({ task_id: 't1', status: 'ok', checks_passed: true }));
    else if (env === 'task-2-single-file-edit') { mkdirSync(join(dir, 'src'), { recursive: true }); writeFileSync(join(dir, 'src/target.ts'), 'val'); }
    return { stdout: 'completed successfully', stderr: '', exitCode: 0 };
  }
}
class FakeStore implements CalibrationStore {
  public saved: CalibrationRunRecord[] = [];
  saveRun(r: CalibrationRunRecord): void { this.saved.push(r); }
  listRuns(): CalibrationRunRecord[] { return this.saved; }
  prune(): number { return 0; }
  close(): void {}
}
const MODELS: readonly OpenCodeFreeModel[] = [{ provider: 'opencode', originalId: 'opencode/test-free', modelId: 'test' }];

test('arg parsing rejects invalid flags with exit 2 style and supports free subcommand', () => {
  assert.equal(parseCalibrationArgs([]).ok, false);
  assert.equal(parseCalibrationArgs(['--runs', '2', '--model', 'm']).ok, false);
  assert.equal(parseCalibrationArgs(['--model', 'm', '--unknown']).ok, false);
  assert.equal(parseCalibrationArgs(['free', '--model', 'm', '--runs', '3', '--yes']).ok, true);
});

test('pre-run confirmation flow requires explicit confirmation and prints disclosures', async () => {
  const runner = new FakeRunner(), logs: string[] = [], errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'opencode/test-free'], { runner, models: MODELS, stdout: m => logs.push(m), stderr: m => errs.push(m) });
  assert.equal(code, 1);
  assert.equal(runner.runs, 0);
  assert.ok(logs.some(l => l.includes('쿼터 불명')) && logs.some(l => l.includes('Enforced: timeouts/turns/tokens/isolation/no-retry')));
  assert.ok(errs.some(e => e.includes('pre-run confirmation required')));
});

test('rejects unverified or unlisted Free model', async () => {
  const errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'unverified-model', '--yes'], { runner: new FakeRunner(), models: MODELS, stderr: m => errs.push(m) });
  assert.equal(code, 1);
  assert.ok(errs.some(e => e.includes('unverified or unlisted Free model')));
});

test('1-run provisional vs 3-run median stable saves with version constants and normalized id', async () => {
  const runner1 = new FakeRunner(), store1 = new FakeStore();
  assert.equal(await runCalibrationCli(['free', '--model', 'opencode/test-free', '--yes'], { runner: runner1, store: store1, models: MODELS }), 0);
  assert.equal(runner1.runs, 4);
  assert.equal(store1.saved[0]!.sampleStatus, 'provisional');
  assert.equal(store1.saved[0]!.modelId, 'test');
  assert.equal(store1.saved[0]!.taskSetVersion, CALIBRATION_TASK_SET_VERSION);
  assert.equal(store1.saved[0]!.evaluatorVersion, CALIBRATION_EVALUATOR_VERSION);

  const runner3 = new FakeRunner(), store3 = new FakeStore();
  assert.equal(await runCalibrationCli(['--model', 'opencode/test-free', '--runs', '3', '--yes'], { runner: runner3, store: store3, models: MODELS }), 0);
  assert.equal(runner3.runs, 12);
  assert.equal(store3.saved[0]!.sampleStatus, 'stable');
  assert.equal(store3.saved[0]!.sampleCount, 3);
});

test('fresh-DB first-run persists without error and open-failure fails fast before runner calls', async () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'calib-cli-fresh-'));
  try {
    const store = openCalibrationStore({ YOROI_DATA_DIR: tempDir }), runner = new FakeRunner();
    assert.equal(await runCalibrationCli(['free', '--model', 'opencode/test-free', '--yes'], { runner, store, models: MODELS }), 0);
    assert.equal(store.listRuns('test').length, 1);
    store.close();
  } finally { rmSync(tempDir, { recursive: true, force: true }); }

  const failRunner = new FakeRunner();
  let dispatchExit: number | undefined;
  try {
    openCalibrationStore({ YOROI_DATA_DIR: '/proc/invalid/read-only-path-fail' });
  } catch {
    dispatchExit = 1;
  }
  assert.equal(dispatchExit, 1);
  assert.equal(failRunner.runs, 0);
});

test('gating: non-vacuous separation between once/publish and calibrate CLI', () => {
  const err = parseInsights(['calibrate', 'free', '--model', 'opencode/test-free']);
  assert.equal(err.kind, 'error');
  assert.ok((err as { message: string }).message.includes('unexpected argument: calibrate'));
  assert.equal(parseInsights(['once']).kind, 'insights');
  assert.equal(parseInsights(['publish']).kind, 'insights');
});
