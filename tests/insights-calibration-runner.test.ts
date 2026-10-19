import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { runCalibration, runCalibrationTask } from '../src/insights/calibration-runner.js';
import { CALIBRATION_TASKS_V1 } from '../src/insights/calibration-task-set.js';
import { createCalibrationSandbox, SANDBOX_CAPS } from '../src/insights/calibration-sandbox.js';

class FakeRunner implements ProcessRunner {
  public requests: ProcessRequest[] = [];
  constructor(private readonly handler: (req: ProcessRequest) => ProcessOutput) {}
  async run(req: ProcessRequest): Promise<ProcessOutput> {
    this.requests.push(req);
    return this.handler(req);
  }
}

test('happy path: 4 synthetic tasks map to explicit passed, scorer verdict, and safe metadata', async () => {
  const fake = new FakeRunner(() => ({ stdout: 'ok', stderr: '', exitCode: 0 }));
  const res = await runCalibration({ runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.taskResults.length, 4);
  assert.equal(res.rawPassedCount, 4);
  assert.ok(res.taskResults.every(t => t.passed === true));
  assert.equal(res.evaluation.verdict, 'capable');
  assert.equal(res.verificationMarker, 'provisional_unknown_verification');
  assert.equal(res.isProvisional, true);
  assert.ok(!/(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,})/.test(JSON.stringify(res)));
});

test('caps enforcement: turn, token, and timeout passed to process runner', async () => {
  const fake = new FakeRunner(() => ({ stdout: '', stderr: '', exitCode: 0 }));
  await runCalibrationTask(CALIBRATION_TASKS_V1[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(fake.requests.length, 1);
  const req = fake.requests[0]!;
  assert.ok(req.args.includes('--max-turns') && req.args.includes(String(SANDBOX_CAPS.MAX_TURNS)));
  assert.ok(req.args.includes('--max-tokens') && req.args.includes(String(SANDBOX_CAPS.MAX_OUTPUT_TOKENS)));
  assert.equal(req.timeoutMs, SANDBOX_CAPS.TASK_TIMEOUT_MS);
});

test('per-task timeout enforcement flags latency failure and sets passed false', async () => {
  const fake = new FakeRunner(() => {
    const start = Date.now();
    while (Date.now() - start < 15) { /* busy wait */ }
    return { stdout: 'done', stderr: '', exitCode: 0 };
  });
  const res = await runCalibrationTask(CALIBRATION_TASKS_V1[0]!, {
    runner: fake, modelOriginalId: 'opencode/test-free', timeoutMs: 5,
  });
  assert.equal(res.rubric.latency_stability, false);
  assert.equal(res.passed, false);
});

test('allowed-file violation triggers unowned_file_modification critical override', async () => {
  let calls = 0;
  const fake = new FakeRunner(req => {
    calls++;
    const dirIdx = req.args.indexOf('--dir');
    const dir = req.args[dirIdx + 1]!;
    if (calls === 1) writeFileSync(join(dir, 'unowned-trap.ts'), 'export const trap = 1;');
    return { stdout: 'wrote', stderr: '', exitCode: 0 };
  });
  const res = await runCalibration({ runner: fake, modelOriginalId: 'opencode/test-free' });
  const taskRes = res.taskResults[0]!;
  assert.ok(taskRes.violationClasses.includes('unowned_file_modification'));
  assert.equal(taskRes.passed, false);
  assert.equal(res.evaluation.verdict, 'not_recommended');
  assert.equal(res.evaluation.hasCriticalViolation, true);
  assert.equal(res.evaluation.overriddenByCritical, true);
});

test('sandbox cleanup removes directory after task run', async () => {
  let createdDir = '';
  const fake = new FakeRunner(req => {
    const dirIdx = req.args.indexOf('--dir');
    createdDir = req.args[dirIdx + 1]!;
    return { stdout: 'ok', stderr: '', exitCode: 0 };
  });
  await runCalibrationTask(CALIBRATION_TASKS_V1[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.ok(createdDir.length > 0);
  await assert.rejects(async () => stat(createdDir));
});
