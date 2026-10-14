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
  /** 플러그인이 로드됐다는 사실·시각·마커 버전(v1|v2, 생략=v1)만 기록한다(락 상태·모델·대화와 무관). */
  markLoaded?(input: { scope: string; observedAt: string; version?: 'v1' | 'v2' }): void;
  loadedAt?(scope: string): string | undefined;
  /** 마지막 loaded 보고의 마커 버전(p43). 미지원 저장소·기록 없음은 undefined. */
  loadedVersion?(scope: string): 'v1' | 'v2' | undefined;
  /** Events with id > afterId, ascending, at most `limit`. Unsupported stores omit it. */
  eventsSince?(scope: string, afterId: number, limit?: number): readonly ZenLockEvent[];
  /** Highest event id for the scope, 0 when none. */
  latestEventId?(scope: string): number;
  close(): void;
}
