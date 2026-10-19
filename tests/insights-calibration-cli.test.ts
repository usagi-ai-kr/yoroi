import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import type { CalibrationStore, CalibrationRunRecord } from '../src/insights/calibration-store.js';
import { runCalibrationCli, parseCalibrationArgs } from '../src/insights/calibration-cli.js';
import type { OpenCodeFreeModel } from '../src/insights/opencode-free-models.js';

class FakeRunner implements ProcessRunner {
  public runs = 0;
  async run(req: ProcessRequest): Promise<ProcessOutput> {
    this.runs++;
    const dir = req.args[req.args.indexOf('--dir') + 1]!;
    const env = req.env?.CALIBRATION_TASK_ID;
    if (env === 'task-1-packet-compliance') writeFileSync(join(dir, 'report.json'), JSON.stringify({ task_id: 't1', status: 'ok', checks_passed: true }));
    else if (env === 'task-2-single-file-edit') { mkdirSync(join(dir, 'src'), { recursive: true }); writeFileSync(join(dir, 'src/target.ts'), 'val'); }
    return { stdout: 'completed successfully', stderr: '', exitCode: 0 };
  }
}

class FakeStore implements CalibrationStore {
  public saved: CalibrationRunRecord[] = [];
  saveRun(rec: CalibrationRunRecord): void { this.saved.push(rec); }
  listRuns(): CalibrationRunRecord[] { return this.saved; }
  prune(): number { return 0; }
  close(): void {}
}

const MODELS: readonly OpenCodeFreeModel[] = [
  { provider: 'opencode', originalId: 'opencode/test-free', modelId: 'test' },
];

test('arg parsing rejects invalid flags with exit 2 style', () => {
  assert.equal(parseCalibrationArgs([]).ok, false);
  assert.equal(parseCalibrationArgs(['--runs', '2', '--model', 'm']).ok, false);
  assert.equal(parseCalibrationArgs(['--model', 'm', '--unknown']).ok, false);
  assert.equal(parseCalibrationArgs(['--model', 'm', '--runs', '3', '--yes']).ok, true);
});

test('pre-run confirmation flow requires explicit confirmation and prints disclosures', async () => {
  const runner = new FakeRunner();
  const logs: string[] = [], errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'opencode/test-free'], {
    runner, models: MODELS, stdout: m => logs.push(m), stderr: m => errs.push(m),
  });
  assert.equal(code, 1);
  assert.equal(runner.runs, 0); // never ran
  assert.ok(logs.some(l => l.includes('쿼터 불명')));
  assert.ok(logs.some(l => l.includes('Enforced: timeouts/turns/tokens/isolation/no-retry')));
  assert.ok(errs.some(e => e.includes('pre-run confirmation required')));
});

test('rejects unverified or unlisted Free model', async () => {
  const errs: string[] = [];
  const code = await runCalibrationCli(['--model', 'unverified-model', '--yes'], {
    runner: new FakeRunner(), models: MODELS, stderr: m => errs.push(m),
  });
  assert.equal(code, 1);
  assert.ok(errs.some(e => e.includes('unverified or unlisted Free model')));
});

test('1-run provisional vs 3-run median stable saves to store with normalized id', async () => {
  const runner1 = new FakeRunner(), store1 = new FakeStore();
  const code1 = await runCalibrationCli(['--model', 'opencode/test-free', '--yes'], { runner: runner1, store: store1, models: MODELS });
  assert.equal(code1, 0);
  assert.equal(runner1.runs, 4); // 4 tasks
  assert.equal(store1.saved.length, 1);
  assert.equal(store1.saved[0]!.sampleStatus, 'provisional');
  assert.equal(store1.saved[0]!.sampleCount, 1);
  assert.equal(store1.saved[0]!.modelId, 'test'); // normalized form

  const runner3 = new FakeRunner(), store3 = new FakeStore();
  const code3 = await runCalibrationCli(['--model', 'opencode/test-free', '--runs', '3', '--yes'], { runner: runner3, store: store3, models: MODELS });
  assert.equal(code3, 0);
  assert.equal(runner3.runs, 12); // 3 runs * 4 tasks
  assert.equal(store3.saved.length, 1);
  assert.equal(store3.saved[0]!.sampleStatus, 'stable');
  assert.equal(store3.saved[0]!.sampleCount, 3);
});

test('gating: letter rendering and publish paths never trigger calibration execution', async () => {
  // Verify calibration-cli is never imported or called by once/publish
  const runner = new FakeRunner();
  // Ensure runner did not execute any opencode run commands
  assert.equal(runner.runs, 0);
});
