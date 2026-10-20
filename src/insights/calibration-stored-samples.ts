import { CRITICAL_VIOLATIONS, median } from './calibration-scorer.js';
import type { CalibrationViolationClass } from './calibration-task-set.js';

/** #180 unit 3 v2: 표본 단위 영속 근거. 집계와 표본별 근거를 함께 저장해 재조회 후 같은 판정을 재구성한다. */
export interface CalibrationStoredTask {
  readonly taskId: string;
  readonly score: number;
  readonly passed: boolean;
  readonly latencyMs: number;
  readonly retryCount: number;
}

/** 실행 1회(표본)의 영속 근거. */
export interface CalibrationStoredSample {
  readonly index: number;
  readonly tasks: readonly CalibrationStoredTask[];
  readonly totalScore: number;
  readonly passedTaskCount: number;
  readonly violationClasses: readonly CalibrationViolationClass[];
}

/** 과제별 표본 집계: 모든 표본의 최소 점수·통과 수. */
export interface CalibrationTaskAggregate {
  readonly taskId: string;
  readonly minScore: number;
  readonly passedCount: number;
  readonly sampleCount: number;
}

/** 명시적 집계 정의. 대표 표본과 집계 방식(kind)을 함께 남긴다. */
export interface CalibrationAggregate {
  readonly kind: 'single' | 'median';
  readonly sampleCount: number;
  readonly medScore: number;
  readonly medPassed: number;
  readonly hasCriticalViolation: boolean;
  readonly representativeSampleIndex: number;
}

/** 표본들의 집계 정의. 1회=그 표본 값, 2회 이상=중앙값(evaluator의 multi-run 규칙과 동일). */
export function aggregateSamples(samples: readonly CalibrationStoredSample[]): CalibrationAggregate {
  if (samples.length === 0) {
    return { kind: 'single', sampleCount: 0, medScore: 0, medPassed: 0, hasCriticalViolation: false, representativeSampleIndex: -1 };
  }
  const medScore = median(samples.map(s => s.totalScore));
  const medPassed = Math.round(median(samples.map(s => s.passedTaskCount)));
  const hasCriticalViolation = samples.some(s => s.violationClasses.some(v => CRITICAL_VIOLATIONS.has(v)));
  let representativeSampleIndex = 0, best = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const distance = Math.abs(sample.totalScore - medScore);
    if (distance < best) { best = distance; representativeSampleIndex = sample.index; }
  }
  return { kind: samples.length === 1 ? 'single' : 'median', sampleCount: samples.length, medScore, medPassed,
    hasCriticalViolation, representativeSampleIndex };
}

/** 과제별 최소 점수·통과 수 집계. 과제 id 오름차순으로 고정한다. */
export function aggregateTasks(samples: readonly CalibrationStoredSample[]): readonly CalibrationTaskAggregate[] {
  const byTask = new Map<string, { scores: number[]; passed: number; count: number }>();
  for (const sample of samples) {
    for (const task of sample.tasks) {
      const entry = byTask.get(task.taskId) ?? { scores: [], passed: 0, count: 0 };
      entry.scores.push(task.score);
      if (task.passed) entry.passed += 1;
      entry.count += 1;
      byTask.set(task.taskId, entry);
    }
  }
  return [...byTask.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([taskId, entry]) => ({
    taskId, minScore: Math.min(...entry.scores), passedCount: entry.passed, sampleCount: entry.count,
  }));
}

/** 저장된 표본만으로 집계 입력(중앙값·통과수·중대위반)을 다시 계산한다 — 재조회 검증용. */
export function recomputeAggregateInputs(samples: readonly CalibrationStoredSample[]): {
  readonly medScore: number; readonly medPassed: number; readonly hasCriticalViolation: boolean;
} {
  const aggregate = aggregateSamples(samples);
  return { medScore: aggregate.medScore, medPassed: aggregate.medPassed, hasCriticalViolation: aggregate.hasCriticalViolation };
}
