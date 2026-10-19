import type { CalibrationSampleStatus, CalibrationVerdict } from './calibration-scorer.js';
import type { CalibrationViolationClass } from './calibration-task-set.js';

/** #180 unit 3: 영속 레코드 계약. 점수와 최소 메타데이터만 저장한다. */
export const CALIBRATION_EVALUATOR_VERSION = 'v1';
/** 모델별 보관 상한(최신 N개 run). saveRun 자동 정리와 prune이 쓴다. */
export const CALIBRATION_HISTORY_CAP = 20;

export interface CalibrationStoredTask {
  readonly taskId: string;
  readonly score: number;
  readonly passed: boolean;
  readonly latencyMs: number;
  readonly retryCount: number;
}
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
}
export interface CalibrationStore {
  saveRun(record: CalibrationRunRecord): void;
  listRuns(modelId: string, taskSetVersion?: string): CalibrationRunRecord[];
  prune(modelId: string, keep?: number): number;
  close(): void;
}

/** 저장 허용 필드. prompt/response/tool-log/diff/자격 계열은 여기에 없어 영속될 수 없다. */
const TASK_FIELDS = ['taskId', 'score', 'passed', 'latencyMs', 'retryCount'] as const;
const RUN_FIELDS = ['runId', 'modelId', 'taskSetVersion', 'evaluatorVersion', 'runAt', 'tasks',
  'violationClasses', 'totalScore', 'verdict', 'sampleStatus', 'sampleCount'] as const;
const pick = (src: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const f of fields) if (src[f] !== undefined) out[f] = src[f];
  return out;
};
/** 러너 원시 입력을 영속 계약으로 좁힌다. 허용 외 필드는 버린다. */
export function toRunRecord(raw: Record<string, unknown>): CalibrationRunRecord {
  const base = pick(raw, RUN_FIELDS) as unknown as CalibrationRunRecord;
  const tasks = Array.isArray(base.tasks) ? base.tasks : [];
  return { ...base,
    tasks: tasks.map(t => pick(t as Record<string, unknown>, TASK_FIELDS) as unknown as CalibrationStoredTask) };
}
export function assertRunRecord(r: CalibrationRunRecord): void {
  for (const k of ['runId', 'modelId', 'runAt'] as const) {
    if (typeof r[k] !== 'string' || !r[k]) throw new Error(`Invalid calibration run record: ${k}`);
  }
  if (!Array.isArray(r.tasks)) throw new Error('Invalid calibration run record: tasks');
}
