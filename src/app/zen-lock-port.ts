export const ZEN_FREE_SCOPE = 'opencode-zen:free';
export interface ZenLockState {
  scope: string; state: 'locked' | 'clear'; model?: string; reason?: string;
  lockedAt?: string; retryAt?: string; clearedAt?: string; updatedAt: string;
}
/** One row of the local lock history (ids ascend; only exceeded/cleared transitions are logged). */
export interface ZenLockEvent {
  id: number; kind: 'exceeded' | 'cleared'; observedAt: string; model?: string; retryAt?: string;
}
export interface ZenLockStore {
  get(scope: string): ZenLockState | undefined;
  markExceeded(input: { scope: string; model?: string; reason?: string; observedAt: string; retryAt?: string }): ZenLockState;
  markOk(input: { scope: string; model?: string; observedAt: string }): { changed: boolean; state?: ZenLockState };
  /** 플러그인이 로드됐다는 사실과 시각만 기록한다(락 상태·모델·대화와 무관). 구현하지 않는 저장소는 기록하지 않는다. */
  markLoaded?(input: { scope: string; observedAt: string }): void;
  loadedAt?(scope: string): string | undefined;
  /** Events with id > afterId, ascending, at most `limit`. Unsupported stores omit it. */
  eventsSince?(scope: string, afterId: number, limit?: number): readonly ZenLockEvent[];
  /** Highest event id for the scope, 0 when none. */
  latestEventId?(scope: string): number;
  close(): void;
}
