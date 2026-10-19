import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { runCalibration, runCalibrationTask } from '../src/insights/calibration-runner.js';
import { CALIBRATION_TASKS_V1 } from '../src/insights/calibration-task-set.js';
import { SANDBOX_CAPS } from '../src/insights/calibration-sandbox.js';

class FakeRunner implements ProcessRunner {
  public requests: ProcessRequest[] = [];
  constructor(private readonly handler: (req: ProcessRequest) => ProcessOutput) {}
  async run(req: ProcessRequest): Promise<ProcessOutput> {
    this.requests.push(req);
    return this.handler(req);
  }
}

function handleSyntheticTask(req: ProcessRequest): ProcessOutput {
  const dir = req.args[req.args.indexOf('--dir') + 1]!;
  const env = req.env?.CALIBRATION_TASK_ID;
  if (env === 'task-1-packet-compliance') {
    writeFileSync(join(dir, 'report.json'), JSON.stringify({ task_id: 't1', status: 'ok', checks_passed: true }));
  } else if (env === 'task-2-single-file-edit') {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src/target.ts'), 'export const val = 2;');
  }
  return { stdout: 'completed successfully', stderr: '', exitCode: 0 };
}

test('happy path: checker validates artifacts and maps to explicit passed', async () => {
  const fake = new FakeRunner(handleSyntheticTask);
  const res = await runCalibration({ runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.taskResults.length, 4);
  assert.equal(res.rawPassedCount, 4);
  assert.ok(res.taskResults.every(t => t.passed === true));
  assert.equal(res.evaluation.verdict, 'capable');
  assert.ok(!/(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,})/.test(JSON.stringify(res)));
});

test('checker integration: schema violation invalidates accuracy and catches hallucination', async () => {
  const fake = new FakeRunner(() => ({ stdout: 'all checks passed and completed', stderr: '', exitCode: 0 }));
  const res = await runCalibrationTask(CALIBRATION_TASKS_V1[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.rubric.accuracy, false);
  assert.equal(res.rubric.evidence_hallucination, false);
  assert.equal(res.claimsWithoutEvidenceCount, 1);
  assert.equal(res.passed, false);
});

test('per-task error isolation: throw/timeout on one task preserves completed tasks', async () => {
  let call = 0;
  const fake = new FakeRunner(req => {
    call++;
    if (call === 2) throw new Error('Task 2 process crashed/aborted');
    return handleSyntheticTask(req);
  });
  const res = await runCalibration({ runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.taskResults.length, 4);
  assert.equal(res.taskResults[0]!.passed, true);
  assert.equal(res.taskResults[1]!.passed, false);
  assert.equal(res.taskResults[2]!.passed, true);
  assert.equal(res.taskResults[3]!.passed, true);
  assert.equal(res.rawPassedCount, 3);
});

test('widened detection: git clone, secret token, and allowed-file violation flagged', async () => {
  const fakeGit = new FakeRunner(() => ({ stdout: 'running git clone https://github.com', stderr: '', exitCode: 0 }));
  const resGit = await runCalibrationTask(CALIBRATION_TASKS_V1[3]!, { runner: fakeGit, modelOriginalId: 'opencode/test-free' });
  assert.ok(resGit.violationClasses.includes('git_mutation'));

  const fakeSec = new FakeRunner(() => ({ stdout: 'leaked ghp_abcdefghijklmnopqrstuvwxyz012345', stderr: '', exitCode: 0 }));
  const resSec = await runCalibrationTask(CALIBRATION_TASKS_V1[3]!, { runner: fakeSec, modelOriginalId: 'opencode/test-free' });
  assert.ok(resSec.violationClasses.includes('raw_secret_exposure'));
});

test('caps enforcement and sandbox cleanup', async () => {
  let capturedDir = '';
  const fake = new FakeRunner(req => {
    capturedDir = req.args[req.args.indexOf('--dir') + 1]!;
    return { stdout: '', stderr: '', exitCode: 0 };
  });
  await runCalibrationTask(CALIBRATION_TASKS_V1[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.ok(fake.requests[0]!.args.includes(String(SANDBOX_CAPS.MAX_TURNS)));
  assert.ok(fake.requests[0]!.args.includes(String(SANDBOX_CAPS.MAX_OUTPUT_TOKENS)));
  await assert.rejects(async () => stat(capturedDir));
});
