import type { ProcessRunner } from '../infra/process-port.js';
import {
  CALIBRATION_TASKS_V1,
  type CalibrationTask, type CalibrationTaskResult,
} from './calibration-task-set.js';
import { evaluateCalibration, type CalibrationEvaluation } from './calibration-scorer.js';
import {
  createCalibrationSandbox, buildSandboxEnv, SANDBOX_CAPS, detectOutputViolations,
} from './calibration-sandbox.js';
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

export async function runCalibrationTask(
  task: CalibrationTask,
  options: CalibrationRunnerOptions,
): Promise<CalibrationTaskResult> {
  const sandbox = await createCalibrationSandbox(task.fixture.allowedFiles);
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? SANDBOX_CAPS.TASK_TIMEOUT_MS;
  try {
    const res = await options.runner.run({
      executable: 'opencode',
      args: ['run', '--model', options.modelOriginalId, '--max-turns', String(SANDBOX_CAPS.MAX_TURNS),
        '--max-tokens', String(SANDBOX_CAPS.MAX_OUTPUT_TOKENS), '--dir', sandbox.dir],
      timeoutMs,
      env: buildSandboxEnv({ CALIBRATION_TASK_ID: task.id }),
      input: task.fixture.prompt,
    }, options.signal);
    const durationMs = Date.now() - start;
    const fileViolations = await sandbox.checkViolations();
    const outViolations = detectOutputViolations(`${res.stdout} ${res.stderr}`);
    const violations = [...new Set([...fileViolations, ...outViolations])];
    const latencyPass = durationMs < timeoutMs;
    const checker = await checkTaskArtifacts({
      taskId: task.id, sandboxDir: sandbox.dir, exitCode: res.exitCode,
      stdout: res.stdout, stderr: res.stderr, fileViolations,
    });
    const rubric = {
      accuracy: checker.accuracy && violations.length === 0,
      instruction_ownership: checker.instruction_ownership && fileViolations.length === 0,
      verification_report: checker.verification_report,
      latency_stability: latencyPass,
      retry: true,
      evidence_hallucination: checker.evidence_hallucination,
    };
    return {
      taskId: task.id, rubric, latencies: { totalMs: durationMs }, retryCount: 0,
      violationClasses: violations, claimsWithoutEvidenceCount: checker.claimsWithoutEvidenceCount,
      passed: rubric.accuracy && latencyPass,
    };
  } finally {
    await sandbox.cleanup();
  }
}

export async function runCalibration(options: CalibrationRunnerOptions): Promise<CalibrationRunResult> {
  const tasks = options.tasks ?? CALIBRATION_TASKS_V1;
  const start = Date.now();
  const results: CalibrationTaskResult[] = [];
  for (const t of tasks) {
    try {
      results.push(await runCalibrationTask(t, options));
    } catch {
      const emptyRubric = { accuracy: false, instruction_ownership: false, verification_report: false, latency_stability: false, retry: false, evidence_hallucination: false };
      results.push({
        taskId: t.id, rubric: emptyRubric, latencies: { totalMs: options.timeoutMs ?? SANDBOX_CAPS.TASK_TIMEOUT_MS },
        retryCount: 0, violationClasses: [], claimsWithoutEvidenceCount: 0, passed: false,
      });
    }
  }
  const rawPassedCount = results.filter(r => r.passed === true).length;
  const evaluation = evaluateCalibration(results, 'provisional');
  return {
    modelId: options.modelOriginalId, taskResults: results, evaluation,
    rawPassedCount, verificationMarker: 'provisional_unknown_verification',
    isProvisional: true, durationMs: Date.now() - start,
  };
}
