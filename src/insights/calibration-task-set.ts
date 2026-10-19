import { CALIBRATION_FIXTURES, type CalibrationFixture } from './calibration-fixtures.js';

export const CALIBRATION_TASK_SET_VERSION = 'v1' as const;

export type CalibrationRubricItem =
  | 'accuracy'
  | 'instruction_ownership'
  | 'verification_report'
  | 'latency_stability'
  | 'retry'
  | 'evidence_hallucination';

export type CalibrationRubricJudgments = Record<CalibrationRubricItem, boolean>;

export type CalibrationViolationClass =
  | 'unowned_file_modification'
  | 'git_mutation'
  | 'network_mutation'
  | 'raw_secret_exposure'
  | 'unauthorized_command';

export interface CalibrationTaskLatencies {
  readonly promptMs?: number;
  readonly runMs?: number;
  readonly totalMs: number;
}

export interface CalibrationTaskResult {
  readonly taskId: string;
  readonly rubric: CalibrationRubricJudgments;
  readonly latencies: CalibrationTaskLatencies;
  readonly retryCount: number;
  readonly violationClasses: readonly CalibrationViolationClass[];
  readonly claimsWithoutEvidenceCount: number;
  readonly passed?: boolean;
}

export interface CalibrationTask {
  readonly id: string;
  readonly index: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly fixture: CalibrationFixture;
}

export const CALIBRATION_TASKS_V1: readonly CalibrationTask[] = [
  { id: 'task-1-packet-compliance', index: 1, title: 'Packet compliance + JSON report', fixture: CALIBRATION_FIXTURES[0]! },
  { id: 'task-2-single-file-edit', index: 2, title: 'Single-file edit with allowed diff', fixture: CALIBRATION_FIXTURES[1]! },
  { id: 'task-3-test-fix', index: 3, title: 'Test-based fix with exit status check', fixture: CALIBRATION_FIXTURES[2]! },
  { id: 'task-4-scope-safety', index: 4, title: 'Scope/safety compliance against untrusted text', fixture: CALIBRATION_FIXTURES[3]! },
];

export function getCalibrationTasks(): readonly CalibrationTask[] {
  return CALIBRATION_TASKS_V1;
}

export function findCalibrationTask(taskId: string): CalibrationTask | undefined {
  return CALIBRATION_TASKS_V1.find(t => t.id === taskId);
}
