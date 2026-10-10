export const ZEN_FREE_SCOPE = 'opencode-zen:free';
export interface ZenLockState {
  scope: string; state: 'locked' | 'clear'; model?: string; reason?: string;
  lockedAt?: string; retryAt?: string; clearedAt?: string; updatedAt: string;
}
export interface ZenLockStore {
  get(scope: string): ZenLockState | undefined;
  markExceeded(input: { scope: string; model?: string; reason?: string; observedAt: string; retryAt?: string }): ZenLockState;
  markOk(input: { scope: string; model?: string; observedAt: string }): { changed: boolean; state?: ZenLockState };
  close(): void;
}
