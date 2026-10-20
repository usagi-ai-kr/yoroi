import type { CalibrationSampleStatus, CalibrationVerdict } from './calibration-scorer.js';
import type { CalibrationViolationClass } from './calibration-task-set.js';
import { toRunRecord, type CalibrationRunRecord } from './calibration-record.js';
import { assertRecordConsistency } from './calibration-store-codec.js';

export { toRunRecord, type CalibrationRunRecord } from './calibration-record.js';
export type { CalibrationAggregate, CalibrationStoredSample, CalibrationStoredTask, CalibrationTaskAggregate } from './calibration-stored-samples.js';

/** #180 unit 3: 영속 레코드 계약. evaluator v2는 집계와 표본 근거를 함께 저장한다. */
export const CALIBRATION_EVALUATOR_VERSION = 'v2';
/** 모델별 보관 상한(최신 N개 run). saveRun 자동 정리와 prune이 쓴다. */
export const CALIBRATION_HISTORY_CAP = 20;

export interface CalibrationStore {
  saveRun(record: CalibrationRunRecord): void;
  listRuns(modelId: string, taskSetVersion?: string): CalibrationRunRecord[];
  prune(modelId: string, keep?: number): number;
  close(): void;
}

/** 저장 허용 필드. prompt/response/tool-log/diff/자격 계열은 여기에 없어 영속될 수 없다. */
export function assertRunRecord(r: CalibrationRunRecord): void {
  for (const k of ['runId', 'modelId', 'runAt'] as const) {
    if (typeof r[k] !== 'string' || !r[k]) throw new Error(`Invalid calibration run record: ${k}`);
  }
  if (!Array.isArray(r.tasks)) throw new Error('Invalid calibration run record: tasks');
  if (r.samples !== undefined && !Array.isArray(r.samples)) throw new Error('Invalid calibration run record: samples');
  assertRecordConsistency(r);
}

export type { CalibrationSampleStatus, CalibrationVerdict, CalibrationViolationClass };
