import { ZEN_FREE_SCOPE, type ZenLockState, type ZenLockStore } from './zen-lock-port.js';

export function getZenLock(store: ZenLockStore): ZenLockState | undefined {
  const state = store.get(ZEN_FREE_SCOPE);
  return state && { ...state };
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
