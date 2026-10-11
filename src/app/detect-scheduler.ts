import { SourceError } from './usage-source.js';

/** 감지 사이클 주기 기본값(10분, 사용자 지시 2026-10-11). 외부 스케줄러에 맡기지 않고 이 모듈이 직접 관리한다. */
export const DEFAULT_DETECT_INTERVAL_MS = 600_000;
const MIN_INTERVAL_MS = 1_000;
const MAX_INTERVAL_MS = 86_400_000;

/** 대기 주입부. milliseconds 뒤에 resolve하고, abort되면 reject한다(구현은 infra 계층). */
export type DetectSleep = (milliseconds: number, signal: AbortSignal) => Promise<void>;

export interface FixedScheduleOptions {
  readonly sleep: DetectSleep;
  /** 주입 시계. 테스트는 가짜를 쓴다. */
  readonly now: () => number;
  readonly intervalMs?: number;
  /** 사이클 예외 보고. 없으면 조용히 넘어간다. */
  readonly onCycleError?: (error: unknown) => void;
}

function validate(intervalMs: number): void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) {
    throw new RangeError('Detect interval must be between 1000 and 86400000 milliseconds');
  }
}

function isCancelled(error: unknown): boolean {
  return error instanceof SourceError && error.code === 'cancelled';
}

/** 고정 주기 감지 루프: 시작 즉시 1회, 이후 직전 시작 + 간격으로 맞춘다.
 * 사이클이 간격을 넘겨도 밀린 틱을 몰아치지 않고 다음 칸으로 건너뛴다(누적 오차 없음).
 * 사이클 예외는 onCycleError로 보고하고 루프를 유지한다. abort는 대기 중에도 즉시 반영한다.
 * 외부 I/O나 타이머를 직접 소유하지 않아 sleep·now를 주입받아 결정적으로 검증된다. */
export async function runFixedSchedule(
  cycle: () => Promise<void>,
  signal: AbortSignal,
  options: FixedScheduleOptions,
): Promise<void> {
  const intervalMs = options.intervalMs ?? DEFAULT_DETECT_INTERVAL_MS;
  validate(intervalMs);
  let previousStart = options.now();
  while (!signal.aborted) {
    try {
      await cycle();
    } catch (error) {
      if (signal.aborted) return;
      options.onCycleError?.(error);
    }
    if (signal.aborted) return;
    previousStart += intervalMs;
    const current = options.now();
    if (previousStart <= current) {
      previousStart += Math.ceil((current - previousStart) / intervalMs) * intervalMs;
    }
    try {
      await options.sleep(previousStart - current, signal);
    } catch (error) {
      if (signal.aborted || isCancelled(error)) return;
      throw error;
    }
  }
}
