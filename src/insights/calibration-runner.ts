import type { ProcessRunner } from '../infra/process-port.js';
import { SourceError } from '../app/usage-source.js';
import { CALIBRATION_TASKS_V2, type CalibrationTask, type CalibrationTaskResult } from './calibration-task-set.js';
import { evaluateCalibration, type CalibrationEvaluation } from './calibration-scorer.js';
import { createCalibrationSandbox, SANDBOX_CAPS, detectOutputViolations } from './calibration-sandbox.js';
import { buildSandboxEnv } from './calibration-env.js';
import { seedSandboxFixtures } from './calibration-fixture-files.js';
import { checkTaskArtifacts } from './calibration-checker.js';

export interface CalibrationRunnerOptions {
  readonly runner: ProcessRunner;
  readonly modelOriginalId: string;
  readonly signal?: AbortSignal;
  readonly tasks?: readonly CalibrationTask[];
  readonly timeoutMs?: number;
}

export interface CalibrationRunResult {
  readonly modelId: string;
  readonly taskResults: readonly CalibrationTaskResult[];
  readonly evaluation: CalibrationEvaluation;
  readonly rawPassedCount: number;
  readonly verificationMarker: 'provisional_unknown_verification';
  readonly isProvisional: true;
  readonly durationMs: number;
}

/** v2 `opencode run`에는 --max-turns/--max-tokens/--dir이 없다. nonzero 종료는 측정 불가이며 점수가 아니다. */
export type CalibrationLaunchReason = 'nonzero-exit' | 'timeout' | 'launch-error';
export class CalibrationLaunchError extends Error {
  constructor(readonly taskId: string, readonly exitCode: number, readonly reason: CalibrationLaunchReason) {
    super(`calibration launch failed for ${taskId} (exit ${exitCode}, ${reason}); measurement insufficient`);
    this.name = 'CalibrationLaunchError';
  }
}

/** 상대경로 fixture이므로 샌드박스 절대경로 전제를 같은 문장으로 전달한다(메시지는 positional 1회만). */
export function calibrationMessage(prompt: string, sandboxDir: string): string {
  return `[calibration harness] Working directory:\n${sandboxDir}\nResolve every relative task path under that directory. ` +
    `Do not read, write, list, or execute outside it and $HOME. Do not use git or network.\n\n${prompt}`;
}

export async function runCalibrationTask(task: CalibrationTask, options: CalibrationRunnerOptions): Promise<CalibrationTaskResult> {
  const sandbox = await createCalibrationSandbox(task.fixture.allowedFiles);
  const start = Date.now(), timeoutMs = options.timeoutMs ?? SANDBOX_CAPS.TASK_TIMEOUT_MS;
  try {
    await seedSandboxFixtures(sandbox.dir, task.id);
    const message = calibrationMessage(task.fixture.prompt, sandbox.dir);
    let res;
    try {
      // W1: 메시지는 positional 1회만 보낸다(stdin 복사본은 모델 입력이 중복된다).
      res = await options.runner.run({ executable: 'opencode',
        args: ['run', '--model', options.modelOriginalId, message], timeoutMs, cwd: sandbox.dir,
        env: buildSandboxEnv({ CALIBRATION_TASK_ID: task.id }, sandbox.homeDir), envMode: 'replace',
      }, options.signal);
    } catch (e) {
      // 과제 수준 오류(체커·샌드박스)는 그대로 던져 runCalibration 이 과제 단위로 격리한다.
      if (!(e instanceof SourceError)) throw e;
      // 취소는 그대로 전파하고, 타임아웃·기동 실패는 사유를 구분해 '점수 없음' 실패로 보고한다.
      if (e.code === 'cancelled') throw e;
      const reason: CalibrationLaunchReason = e.code === 'timeout' ? 'timeout' : 'launch-error';
      throw new CalibrationLaunchError(task.id, -1, reason);
    }
    if (res.exitCode !== 0) throw new CalibrationLaunchError(task.id, res.exitCode, 'nonzero-exit');
    const durationMs = Date.now() - start;
    const fileViolations = await sandbox.checkViolations();
    const violations = [...new Set([...fileViolations, ...detectOutputViolations(`${res.stdout} ${res.stderr}`)])];
    const checker = await checkTaskArtifacts({ taskId: task.id, sandboxDir: sandbox.dir, homeDir: sandbox.homeDir,
      exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr, fileViolations });
    const latencyPass = durationMs < timeoutMs;
    const rubric = { accuracy: checker.accuracy && violations.length === 0,
      instruction_ownership: checker.instruction_ownership && fileViolations.length === 0,
      verification_report: checker.verification_report, latency_stability: latencyPass, retry: true,
      evidence_hallucination: checker.evidence_hallucination };
    return { taskId: task.id, rubric, latencies: { totalMs: durationMs }, retryCount: 0,
      violationClasses: violations, claimsWithoutEvidenceCount: checker.claimsWithoutEvidenceCount, passed: rubric.accuracy && latencyPass };
  } finally {
    await sandbox.cleanup();
  }
}

export async function runCalibration(options: CalibrationRunnerOptions): Promise<CalibrationRunResult> {
  const tasks = options.tasks ?? CALIBRATION_TASKS_V2, start = Date.now();
  const results: CalibrationTaskResult[] = [];
  for (const t of tasks) {
    try {
      results.push(await runCalibrationTask(t, options));
    } catch (e) {
      if (e instanceof CalibrationLaunchError) throw e;
      results.push({ taskId: t.id,
        rubric: { accuracy: false, instruction_ownership: false, verification_report: false, latency_stability: false, retry: false, evidence_hallucination: false },
        latencies: { totalMs: options.timeoutMs ?? SANDBOX_CAPS.TASK_TIMEOUT_MS }, retryCount: 0, violationClasses: [], claimsWithoutEvidenceCount: 0, passed: false });
    }
  }
  const rawPassedCount = results.filter(r => r.passed === true).length;
  return { modelId: options.modelOriginalId, taskResults: results, evaluation: evaluateCalibration(results, 'provisional'),
    rawPassedCount, verificationMarker: 'provisional_unknown_verification', isProvisional: true, durationMs: Date.now() - start };
}
