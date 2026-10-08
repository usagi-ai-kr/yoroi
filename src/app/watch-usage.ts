import { collectOnce } from './collect-once.js';
import { SourceError, type UsageResult, type UsageSource } from './usage-source.js';

export interface Scheduler {
  sleep(milliseconds: number, signal: AbortSignal): Promise<void>;
}
export async function* watchUsage(sources: readonly UsageSource[], scheduler: Scheduler,
  signal: AbortSignal, intervalMs = 60000): AsyncGenerator<readonly UsageResult[]> {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0 || intervalMs > 86400000) {
    throw new Error('Watch interval must be between 1 and 86400000 milliseconds');
  }
  while (!signal.aborted) {
    const results = await collectOnce(sources, signal);
    if (signal.aborted) return;
    yield results;
    if (signal.aborted) return;
    try {
      await scheduler.sleep(intervalMs, signal);
    } catch (error) {
      if (signal.aborted || (error instanceof SourceError && error.code === 'cancelled')) return;
      throw error;
    }
  }
}
