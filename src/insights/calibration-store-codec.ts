import type { CalibrationRunRecord } from './calibration-record.js';
import type { CalibrationAggregate, CalibrationStoredSample, CalibrationStoredTask, CalibrationTaskAggregate } from './calibration-stored-samples.js';
import { recomputeAggregateInputs } from './calibration-stored-samples.js';
import { CRITICAL_VIOLATIONS, type CalibrationVerdict } from './calibration-scorer.js';
import type { CalibrationViolationClass } from './calibration-task-set.js';

/** #180 unit 3 v2: tasks_json payloads. 명시 버전 JSON 표현 + 기존 배열형(구버전) 호환. */
export const CALIBRATION_PAYLOAD_VERSION = 'v2';

export interface CalibrationStoredPayload {
  readonly version: typeof CALIBRATION_PAYLOAD_VERSION;
  readonly samples: readonly CalibrationStoredSample[];
  readonly taskAggregates: readonly CalibrationTaskAggregate[];
  readonly aggregate: CalibrationAggregate; }

export interface CalibrationDecodedPayload {
  /** 대표 표본의 과제 상세(구버전 배열과 같은 의미로 읽힌다). */
  readonly tasks: readonly CalibrationStoredTask[];
  readonly payload?: CalibrationStoredPayload;
}

/** 위반 종류는 문자열만 남긴다(파손 요소는 표시에만 영향). */
export function sanitizeViolationClasses(value: unknown): CalibrationViolationClass[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CalibrationViolationClass => typeof item === 'string');
}

/** v2 레코드는 버전 객체로, 구버전은 배열로 직렬화한다(기존 DB 행과 호환). */
export function encodeCalibrationPayload(record: CalibrationRunRecord): string {
  if (record.samples === undefined || record.aggregate === undefined) return JSON.stringify(record.tasks);
  const payload: CalibrationStoredPayload = { version: CALIBRATION_PAYLOAD_VERSION, samples: record.samples,
    taskAggregates: record.taskAggregates ?? [], aggregate: record.aggregate };
  return JSON.stringify(payload);
}

/** 디코드. 배열형(구버전 v1)은 samples 없이 tasks만 돌려준다. */
export function decodeCalibrationPayload(json: string): CalibrationDecodedPayload {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { tasks: [] }; }
  if (Array.isArray(parsed)) return { tasks: parsed as CalibrationStoredTask[] };
  if (typeof parsed !== 'object' || parsed === null) return { tasks: [] };
  const rec = parsed as Record<string, unknown>;
  if (rec.version !== CALIBRATION_PAYLOAD_VERSION || !Array.isArray(rec.samples) || typeof rec.aggregate !== 'object') {
    return { tasks: Array.isArray(rec.tasks) ? rec.tasks as CalibrationStoredTask[] : [] };
  }
  const payload = rec as unknown as CalibrationStoredPayload;
  const representative = payload.samples.find(s => s.index === payload.aggregate.representativeSampleIndex);
  return { tasks: representative?.tasks ?? payload.samples[0]?.tasks ?? [], payload };
}

/** scorer(calibration-scorer.ts)의 determineVerdict 미러. scorer가 비공개 함수라 규칙을 옮겼고,
 *  tests/insights-calibration-multirun-store.test.ts가 scorer 공개 API와 대조해 분기한다. */
export function expectedVerdict(score: number, passed: number, hasCritical: boolean): CalibrationVerdict {
  if (hasCritical) return 'not_recommended';
  if (score >= 80 && passed >= 3) return 'capable';
  if (score >= 60 && passed >= 2) return 'assistant';
  return 'not_recommended';
}
const round1 = (value: number): number => Math.round(value * 10) / 10;
/** 표본 점수는 과제 점수 평균(evaluator 규칙)으로 다시 계산한다. */
const meanScore = (scores: readonly number[]): number =>
  scores.length ? round1(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;

/** 저장 레코드 내부 일관성 검증. 위조된 점수·판정·집계를 거부한다(샘플 없는 구버전 포함). */
export function assertRecordConsistency(record: CalibrationRunRecord): void {
  const samples = record.samples;
  if (samples !== undefined && samples.length > 0) {
    for (const sample of samples) {
      if (sample.totalScore !== meanScore(sample.tasks.map(task => task.score))) {
        throw new Error(`Invalid calibration run record: sample ${sample.index} totalScore mismatch`);
      }
      if (sample.passedTaskCount !== sample.tasks.filter(task => task.passed).length) {
        throw new Error(`Invalid calibration run record: sample ${sample.index} passedTaskCount mismatch`);
      }
    }
    const aggregate = record.aggregate;
    if (aggregate === undefined) throw new Error('Invalid calibration run record: aggregate missing');
    const inputs = recomputeAggregateInputs(samples);
    if (aggregate.medScore !== inputs.medScore || aggregate.medPassed !== inputs.medPassed
      || aggregate.hasCriticalViolation !== inputs.hasCriticalViolation) {
      throw new Error('Invalid calibration run record: aggregate mismatch');
    }
    if (record.totalScore !== aggregate.medScore) throw new Error('Invalid calibration run record: totalScore mismatch');
    if (record.sampleStatus !== (record.sampleCount >= 3 ? 'stable' : 'provisional')) {
      throw new Error('Invalid calibration run record: sampleStatus mismatch');
    }
  } else {
    // 구버전(샘플 없음): 점수 일관성만 검증하고 판정·표본 표기는 기록된 값을 유지한다.
    const scores = record.tasks.map(task => task.score);
    if (scores.length > 0 && record.totalScore !== meanScore(scores)) {
      throw new Error('Invalid calibration run record: totalScore mismatch');
    }
    return;
  }
  const passed = record.aggregate?.medPassed ?? 0;
  const hasCritical = record.violationClasses.some(v => CRITICAL_VIOLATIONS.has(v));
  if (record.verdict !== expectedVerdict(record.totalScore, passed, hasCritical)) {
    throw new Error('Invalid calibration run record: verdict mismatch');
  }
}
