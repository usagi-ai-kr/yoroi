import { randomUUID } from 'node:crypto';
import type { ProcessRunner } from '../infra/process-port.js';
import { CALIBRATION_EVALUATOR_VERSION, type CalibrationStore, type CalibrationRunRecord } from './calibration-store.js';
import { CALIBRATION_TASK_SET_VERSION } from './calibration-task-set.js';
import { runCalibration, type CalibrationRunResult } from './calibration-runner.js';
import { computeTaskScore, evaluateMultiRunCalibration, type CalibrationEvaluation } from './calibration-scorer.js';
import { collectOpenCodeFreeModels, type OpenCodeFreeModel } from './opencode-free-models.js';
import { normalizeModelName } from './letter-top10-rank.js';
import { SANDBOX_CAPS } from './calibration-sandbox.js';

export interface CalibrationCliArgs {
  readonly model: string;
  readonly runs: 1 | 3;
  readonly yes: boolean;
}

export interface CalibrationCliDeps {
  readonly runner: ProcessRunner;
  readonly store?: CalibrationStore;
  readonly models?: readonly OpenCodeFreeModel[];
  readonly stdout?: (msg: string) => void;
  readonly stderr?: (msg: string) => void;
}

export function parseCalibrationArgs(argv: readonly string[]): { ok: true; args: CalibrationCliArgs } | { ok: false; error: string } {
  const args = argv[0] === 'free' ? argv.slice(1) : argv;
  let model: string | undefined, runs: 1 | 3 = 1, yes = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--model') {
      model = args[++i];
      if (!model || model.startsWith('-')) return { ok: false, error: 'missing value for --model' };
    } else if (a === '--runs') {
      const v = args[++i];
      if (v === '1' || v === '3') runs = Number(v) as 1 | 3;
      else return { ok: false, error: 'invalid --runs; must be 1 or 3' };
    } else if (a === '--yes' || a === '-y') {
      yes = true;
    } else {
      return { ok: false, error: `unexpected argument: ${a}` };
    }
  }
  if (!model) return { ok: false, error: 'missing required --model' };
  return { ok: true, args: { model, runs, yes } };
}

export async function runCalibrationCli(argv: readonly string[], deps: CalibrationCliDeps): Promise<number> {
  const log = deps.stdout ?? console.log, err = deps.stderr ?? console.error;
  if (argv.includes('--help') || argv.includes('-h')) {
    log('Usage: yoroi insights calibrate free --model <id> [--runs 1|3] [--yes]');
    return 0;
  }
  const parsed = parseCalibrationArgs(argv);
  if (!parsed.ok) { err(`calibration: ${parsed.error}`); return 2; }
  const { model: reqModel, runs, yes } = parsed.args;

  const models = deps.models ?? await collectOpenCodeFreeModels(deps.runner);
  const found = models.find(m => m.originalId === reqModel || m.modelId === reqModel);
  if (!found) { err(`calibration: unverified or unlisted Free model: ${reqModel}`); return 1; }

  log(`[모델 선택] ${found.originalId} (정규화: ${normalizeModelName(found.modelId)})`);
  log(`[실행 계획] ${runs}회 실행 (예상 과제: ${runs * 4}건, 턴: ${SANDBOX_CAPS.MAX_TURNS}, 토큰: ${SANDBOX_CAPS.MAX_OUTPUT_TOKENS}, 타임아웃: 5분)`);
  log(`[쿼터 안내] 쿼터 불명 (수치 한도 미공개 또는 클라이언트 세션 한정)`);
  log(`[강제 수준] Enforced: timeouts/turns/tokens/isolation/no-retry; Detect-and-flag: network/git`);
  if (!yes) { err('calibration: pre-run confirmation required (--yes)'); return 1; }

  const runResults: CalibrationRunResult[] = [];
  for (let i = 0; i < runs; i++) runResults.push(await runCalibration({ runner: deps.runner, modelOriginalId: found.originalId }));
  const evalResult: CalibrationEvaluation = runs === 3
    ? evaluateMultiRunCalibration(runResults.map(r => r.taskResults))
    : runResults[0]!.evaluation;

  const normalizedId = normalizeModelName(found.modelId);
  const record: CalibrationRunRecord = {
    runId: `calib-${Date.now()}-${randomUUID().slice(0, 8)}`,
    modelId: normalizedId,
    taskSetVersion: CALIBRATION_TASK_SET_VERSION,
    evaluatorVersion: CALIBRATION_EVALUATOR_VERSION,
    runAt: new Date().toISOString(),
    tasks: runResults[0]!.taskResults.map(t => ({
      taskId: t.taskId, score: computeTaskScore(t.rubric), passed: t.passed ?? false,
      latencyMs: t.latencies.totalMs, retryCount: t.retryCount,
    })),
    violationClasses: [...new Set(runResults.flatMap(r => r.taskResults.flatMap(t => t.violationClasses)))],
    totalScore: evalResult.totalScore,
    verdict: evalResult.verdict,
    sampleStatus: runs === 3 ? 'stable' : 'provisional',
    sampleCount: runs,
  };
  if (deps.store) deps.store.saveRun(record);

  log(`--- 캘리브레이션 결과 요약 ---`);
  log(`판정: ${evalResult.verdictLabel} (${evalResult.verdict})`);
  log(`점수: ${evalResult.totalScore}/100 | 표본: ${record.sampleStatus} (${runs}회)`);
  for (const t of runResults[0]!.taskResults) log(`- ${t.taskId}: ${t.passed ? 'PASS' : 'FAIL'}`);
  return 0;
}
