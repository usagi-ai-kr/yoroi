import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { ProcessOutput, ProcessRequest, ProcessRunner } from '../src/infra/process-port.js';
import { SourceError } from '../src/app/usage-source.js';
import { runCalibration, runCalibrationTask, CalibrationLaunchError } from '../src/insights/calibration-runner.js';
import { CALIBRATION_TASKS_V2 } from '../src/insights/calibration-task-set.js';

class FakeRunner implements ProcessRunner {
  public requests: ProcessRequest[] = [];
  constructor(private readonly handler: (req: ProcessRequest) => ProcessOutput) {}
  async run(req: ProcessRequest): Promise<ProcessOutput> { this.requests.push(req); return this.handler(req); }
}
const sandboxDirOf = (req: ProcessRequest): string => {
  const m = /Working directory:\n(\S+)/.exec(`${req.args[req.args.length - 1] ?? ''}\n${req.input ?? ''}`);
  if (!m?.[1]) throw new Error('test fake: working directory missing from v2 message');
  return m[1];
};
function handleSyntheticTask(req: ProcessRequest): ProcessOutput {
  const dir = sandboxDirOf(req), env = req.env?.CALIBRATION_TASK_ID;
  if (env === 'task-1-packet-compliance') writeFileSync(join(dir, 'report.json'), JSON.stringify({ task_id: 't1', status: 'ok', checks_passed: true }));
  else if (env === 'task-2-single-file-edit') writeFileSync(join(dir, 'src/target.ts'), 'export function targetValue(x: number): number { return x * 2; }\n');
  else if (env === 'task-3-test-fix') writeFileSync(join(dir, 'src/math.ts'), 'export function add(a: number, b: number): number { return a + b; }\n');
  return { stdout: 'completed successfully', stderr: '', exitCode: 0 };
}

test('v2 invocation: positional message with working directory, no legacy flags', async () => {
  const fake = new FakeRunner(handleSyntheticTask);
  await runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  const req = fake.requests[0]!;
  assert.equal(req.executable, 'opencode');
  assert.deepEqual(req.args.slice(0, 3), ['run', '--model', 'opencode/test-free']);
  assert.ok(!req.args.some(a => a === '--max-turns' || a === '--max-tokens' || a === '--dir'));
  assert.ok(req.args[3]!.includes('Working directory:') && req.args[3]!.includes('synthetic-packet'));
  assert.equal(req.input, undefined, '메시지는 positional 1회만 보낸다(stdin 복사본은 모델 입력이 중복된다)');
  assert.ok(req.cwd !== undefined && req.cwd.length > 0, '샌드박스 cwd 로 실행한다');
  assert.equal(req.envMode, 'replace');
});

test('launch failure: nonzero exit throws, runCalibration rethrows without scores', async () => {
  const usage = new FakeRunner(() => ({ stdout: '', stderr: 'Unknown flag --dir', exitCode: 1 }));
  await assert.rejects(runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: usage, modelOriginalId: 'opencode/test-free' }), /launch failed/);
  await assert.rejects(runCalibration({ runner: usage, modelOriginalId: 'opencode/test-free' }), /launch failed/);
});

test('launch error semantics: timeout은 사유를 남기고 취소는 그대로 전파한다', async () => {
  const timedOut = new FakeRunner(() => { throw new SourceError('timeout'); });
  await assert.rejects(runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: timedOut, modelOriginalId: 'opencode/test-free' }),
    (e: unknown) => e instanceof CalibrationLaunchError && e.reason === 'timeout' && e.exitCode === -1);
  const cancelled = new FakeRunner(() => { throw new SourceError('cancelled'); });
  await assert.rejects(runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: cancelled, modelOriginalId: 'opencode/test-free' }),
    (e: unknown) => e instanceof SourceError && e.code === 'cancelled');
});

test('happy path: checker validates artifacts and maps to explicit passed with replace env', async () => {
  const fake = new FakeRunner(handleSyntheticTask);
  const res = await runCalibration({ runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.taskResults.length, 4); assert.equal(res.rawPassedCount, 4);
  assert.ok(res.taskResults.every(t => t.passed === true));
  assert.ok(fake.requests.every(r => r.env?.HOME !== undefined && !r.env.HOME.includes('young-mini')));
});

test('checker integration: schema violation invalidates accuracy and catches hallucination', async () => {
  const fake = new FakeRunner(() => ({ stdout: 'all checks passed and completed', stderr: '', exitCode: 0 }));
  const res = await runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.rubric.accuracy, false); assert.equal(res.passed, false);
  assert.equal(res.claimsWithoutEvidenceCount, 1);
});

test('per-task error isolation: throw on one task preserves completed tasks', async () => {
  let call = 0;
  const fake = new FakeRunner(req => { call++; if (call === 2) throw new Error('Task 2 crashed'); return handleSyntheticTask(req); });
  const res = await runCalibration({ runner: fake, modelOriginalId: 'opencode/test-free' });
  assert.equal(res.taskResults.length, 4);
  assert.ok(res.taskResults[0]!.passed && !res.taskResults[1]!.passed && res.taskResults[2]!.passed);
});

test('widened detection: git clone, secret token, and trap file flagged', async () => {
  const fakeGit = new FakeRunner(() => ({ stdout: 'running git clone https://github.com', stderr: '', exitCode: 0 }));
  assert.ok((await runCalibrationTask(CALIBRATION_TASKS_V2[3]!, { runner: fakeGit, modelOriginalId: 'opencode/test-free' })).violationClasses.includes('git_mutation'));
  const fakeSec = new FakeRunner(() => ({ stdout: 'leaked ghp_abcdefghijklmnopqrstuvwxyz012345', stderr: '', exitCode: 0 }));
  assert.ok((await runCalibrationTask(CALIBRATION_TASKS_V2[3]!, { runner: fakeSec, modelOriginalId: 'opencode/test-free' })).violationClasses.includes('raw_secret_exposure'));
  const fakeTrap = new FakeRunner(req => { writeFileSync(join(sandboxDirOf(req), 'unowned-trap.ts'), 'export const trap = 1;'); return { stdout: 'wrote', stderr: '', exitCode: 0 }; });
  const resTrap = await runCalibrationTask(CALIBRATION_TASKS_V2[1]!, { runner: fakeTrap, modelOriginalId: 'opencode/test-free' });
  assert.ok(resTrap.violationClasses.includes('unowned_file_modification') && !resTrap.passed);
});

test('sandbox cleanup removes both dir and homeDir', async () => {
  let captured = '';
  const fake = new FakeRunner(req => { captured = `${sandboxDirOf(req)}|${req.env?.HOME ?? ''}`; return { stdout: '', stderr: '', exitCode: 0 }; });
  await runCalibrationTask(CALIBRATION_TASKS_V2[0]!, { runner: fake, modelOriginalId: 'opencode/test-free' });
  const [dir, home] = captured.split('|');
  await assert.rejects(async () => stat(dir!)); await assert.rejects(async () => stat(home!));
});
