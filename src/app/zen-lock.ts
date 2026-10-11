import { ZEN_FREE_SCOPE, type ZenLockState, type ZenLockStore } from './zen-lock-port.js';

export function getZenLock(store: ZenLockStore): ZenLockState | undefined {
  const state = store.get(ZEN_FREE_SCOPE);
  return state && { ...state };
}

/** 로드 사실과 시각만 기록한다. 지원하지 않는 저장소면 아무것도 하지 않는다. */
export function markZenLoaded(store: ZenLockStore, input: { observedAt: string }): void {
  store.markLoaded?.({ ...input, scope: ZEN_FREE_SCOPE });
}

/** 마지막 로드 시각. 미기록·미지원·읽기 실패는 undefined다(상태 조회를 막지 않는다). */
export function getZenLoadedAt(store: ZenLockStore): string | undefined {
  try { return store.loadedAt?.(ZEN_FREE_SCOPE); } catch { return undefined; }
}

export function markZenExceeded(store: ZenLockStore, input: {
  model?: string; reason?: string; observedAt: string; retryAt?: string;
}): ZenLockState {
  return store.markExceeded({ ...input, scope: ZEN_FREE_SCOPE });
}

export function markZenOk(store: ZenLockStore, input: {
  model?: string; observedAt: string;
}): { changed: boolean; state?: ZenLockState } {
  return store.markOk({ ...input, scope: ZEN_FREE_SCOPE });
}
