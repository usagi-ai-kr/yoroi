import { computeTaskScore, evaluateCalibration, evaluateMultiRunCalibration, isTaskPassed, type CalibrationEvaluation, type CalibrationSampleStatus, type CalibrationVerdict } from './calibration-scorer.js';
import type { CalibrationRunResult } from './calibration-runner.js';
import type { CalibrationViolationClass } from './calibration-task-set.js';
import {
  aggregateSamples, aggregateTasks, type CalibrationAggregate, type CalibrationStoredSample,
  type CalibrationStoredTask, type CalibrationTaskAggregate,
} from './calibration-stored-samples.js';
import { sanitizeViolationClasses } from './calibration-store-codec.js';

/** #180 unit 3 v2: 영속 레코드 계약(집계 + 표본별 근거). evaluator는 v2로 구분한다. */
export const CALIBRATION_RECORD_VERSION = 'v2';

/** v2 레코드. tasks는 대표 표본의 과제 상세(구버전 호환 필드)이고, 판정 근거는 samples·aggregate다. */
export interface CalibrationRunRecord {
  readonly runId: string;
  readonly modelId: string;
  readonly taskSetVersion: string;
  readonly evaluatorVersion: string;
  readonly runAt: string;
  readonly tasks: readonly CalibrationStoredTask[];
  readonly violationClasses: readonly CalibrationViolationClass[];
  readonly totalScore: number;
  readonly verdict: CalibrationVerdict;
  readonly sampleStatus: CalibrationSampleStatus;
  readonly sampleCount: number;
  /** 모든 표본의 근거. 표본 순서와 무관하게 보존한다. */
  readonly samples?: readonly CalibrationStoredSample[];
  /** 과제별 최소 점수·통과 수. */
  readonly taskAggregates?: readonly CalibrationTaskAggregate[];
  /** 명시적 집계 정의(방식·중앙값·대표 표본). */
  readonly aggregate?: CalibrationAggregate;
}

/** 저장 허용 필드. prompt/response/tool-log/diff/자격 계열은 어디에도 없어 영속될 수 없다. */
const TASK_FIELDS = ['taskId', 'score', 'passed', 'latencyMs', 'retryCount'] as const;
const SAMPLE_FIELDS = ['index', 'tasks', 'totalScore', 'passedTaskCount', 'violationClasses'] as const;
const AGGREGATE_FIELDS = ['kind', 'sampleCount', 'medScore', 'medPassed', 'hasCriticalViolation', 'representativeSampleIndex'] as const;
const TASK_AGGREGATE_FIELDS = ['taskId', 'minScore', 'passedCount', 'sampleCount'] as const;
const RUN_FIELDS = ['runId', 'modelId', 'taskSetVersion', 'evaluatorVersion', 'runAt', 'tasks', 'violationClasses',
  'totalScore', 'verdict', 'sampleStatus', 'sampleCount', 'samples', 'taskAggregates', 'aggregate'] as const;

const pick = (src: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (src[f] !== undefined) out[f] = src[f];
  return out;
};
const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value as Record<string, unknown> : {};

/** 러너 원시 입력을 영속 계약으로 좁힌다. 허용 외 필드는 버린다(중첩 표본에도 동일 적용). */
export function toRunRecord(raw: Record<string, unknown>): CalibrationRunRecord {
  const base = pick(raw, RUN_FIELDS);
  const tasks = Array.isArray(base.tasks) ? base.tasks.map(t => pick(asRecord(t), TASK_FIELDS)) : [];
  const samples = Array.isArray(base.samples) ? base.samples.map(s => {
    const rec = asRecord(s), inner = Array.isArray(rec.tasks) ? rec.tasks : [];
    return { ...(pick(rec, SAMPLE_FIELDS) as object), tasks: inner.map(t => pick(asRecord(t), TASK_FIELDS)) };
  }) : undefined;
  const taskAggregates = Array.isArray(base.taskAggregates)
    ? base.taskAggregates.map(t => pick(asRecord(t), TASK_AGGREGATE_FIELDS)) : undefined;
  const aggregate = base.aggregate === undefined ? undefined : pick(asRecord(base.aggregate), AGGREGATE_FIELDS);
  return { ...base, tasks, violationClasses: sanitizeViolationClasses(base.violationClasses),
    ...(samples !== undefined && { samples: samples as unknown as readonly CalibrationStoredSample[] }),
    ...(taskAggregates !== undefined && { taskAggregates: taskAggregates as unknown as readonly CalibrationTaskAggregate[] }),
    ...(aggregate !== undefined && { aggregate: aggregate as unknown as CalibrationAggregate }) } as unknown as CalibrationRunRecord;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/** 러너 결과(1회 이상)를 집계 정의 + 표본 근거가 있는 레코드로 만든다.
 *  표본 점수·통과수는 run.evaluation이 아니라 taskResults에서 다시 계산한다(변조 차단). */
export function buildCalibrationRunRecord(input: {
  readonly runId: string; readonly modelId: string; readonly taskSetVersion: string;
  readonly evaluatorVersion: string; readonly runAt: string; readonly runs: readonly CalibrationRunResult[];
}): { record: CalibrationRunRecord; evaluation: CalibrationEvaluation } {
  const samples: CalibrationStoredSample[] = input.runs.map((run, index) => {
    const tasks = run.taskResults.map(t => ({ taskId: t.taskId, score: computeTaskScore(t.rubric),
      passed: t.passed ?? isTaskPassed(t), latencyMs: t.latencies.totalMs, retryCount: t.retryCount }));
    const scores = tasks.map(t => t.score);
    return { index, tasks,
      totalScore: scores.length ? round1(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      passedTaskCount: tasks.filter(t => t.passed).length,
      violationClasses: sanitizeViolationClasses(run.taskResults.flatMap(t => t.violationClasses)) };
  });
  const aggregate = aggregateSamples(samples);
  const evaluation = input.runs.length >= 3
    ? evaluateMultiRunCalibration(input.runs.map(r => r.taskResults))
    : evaluateCalibration(input.runs[0]?.taskResults ?? []);
  const representative = samples.find(s => s.index === aggregate.representativeSampleIndex);
  const record: CalibrationRunRecord = {
    runId: input.runId, modelId: input.modelId, taskSetVersion: input.taskSetVersion,
    evaluatorVersion: input.evaluatorVersion, runAt: input.runAt,
    tasks: representative?.tasks ?? [],
    violationClasses: [...new Set(samples.flatMap(s => s.violationClasses))],
    totalScore: aggregate.medScore, verdict: evaluation.verdict, sampleStatus: evaluation.sampleStatus,
    sampleCount: samples.length, samples, taskAggregates: aggregateTasks(samples), aggregate,
  };
  return { record, evaluation };
}
