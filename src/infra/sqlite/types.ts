import type { UsageSnapshot } from '../../domain/usage.js';
import type { UsageCacheKey } from '../../app/usage-cache-port.js';
import type { UsageHistoryContext, UsageHistoryKey, UsageHistoryRetention,
  UsageObservationPair } from '../../app/usage-history-port.js';
import type { ZenLockState } from '../../app/zen-lock-port.js';

/** 모든 SQLite 저장소가 구현하는 수명주기 계약(빌린 연결은 닫지 않는다). */
export interface StorageConnection { close(): void; }

/** 캐시 저장소 계약(app `UsageCache`와 구조적으로 동일). */
export interface UsageCacheStore extends StorageConnection {
  get(key: UsageCacheKey, now: number): UsageSnapshot | undefined;
  set(key: UsageCacheKey, snapshot: UsageSnapshot): void;
  prune(now: number): number;
}

/** 관측 이력 저장소 계약(app `UsageHistory`와 구조적으로 동일). */
export interface UsageHistoryStore extends StorageConnection {
  record(snapshot: UsageSnapshot, context: UsageHistoryContext): void;
  latestTwo(key: UsageHistoryKey): UsageObservationPair;
  prune(retention: UsageHistoryRetention): number;
}

export interface ZenLockExceededInput {
  scope: string; model?: string; reason?: string; observedAt: string; retryAt?: string;
}
export interface ZenLockOkInput { scope: string; model?: string; observedAt: string; }

/** Zen 락 저장소 계약(app `ZenLockStore`와 구조적으로 동일). */
export interface ZenLockStore extends StorageConnection {
  get(scope: string): ZenLockState | undefined;
  markExceeded(input: ZenLockExceededInput): ZenLockState;
  markOk(input: ZenLockOkInput): { changed: boolean; state?: ZenLockState };
  markLoaded?(input: { scope: string; observedAt: string }): void;
  loadedAt?(scope: string): string | undefined;
}
