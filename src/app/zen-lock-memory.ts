import type { ZenLockState, ZenLockStore } from './zen-lock-port.js';

type ExceededInput = { scope: string; model?: string; reason?: string; observedAt: string; retryAt?: string };
type OkInput = { scope: string; model?: string; observedAt: string };

/** updated_at은 상태와 무관하게 지금까지 본 최신 관측 시각이다. 그보다 이른 관측은 늦게 도착한 것이다. */
export function isStale(observedAt: string, state: ZenLockState): boolean {
  return Date.parse(observedAt) < Math.max(Date.parse(state.lockedAt ?? ''), Date.parse(state.updatedAt));
}

/** exceeded 적용 결과. 늦게 도착한 관측이면 undefined(무시)다. */
export function applyExceeded(prev: ZenLockState | undefined, input: ExceededInput): ZenLockState | undefined {
  if (prev && isStale(input.observedAt, prev)) return undefined;
  const locked = prev?.state === 'locked' ? prev : undefined;
  const retryAt = input.retryAt ?? locked?.retryAt;
  return { scope: input.scope, state: 'locked', lockedAt: locked?.lockedAt ?? input.observedAt,
    updatedAt: input.observedAt, ...(input.model && { model: input.model }),
    ...(input.reason && { reason: input.reason }), ...(retryAt && { retryAt }) };
}

/** ok 적용 결과. locked만 clear로 바꾸고, 행이 있으면 늦지 않은 관측으로 updated_at만 전진시킨다. */
export function applyOk(prev: ZenLockState | undefined, input: OkInput): { changed: boolean; state?: ZenLockState } {
  if (!prev || isStale(input.observedAt, prev)) return { changed: false, ...(prev && { state: prev }) };
  const state: ZenLockState = { ...prev, updatedAt: input.observedAt };
  if (prev.state !== 'locked') return { changed: false, state };
  return { changed: true, state: { ...state, state: 'clear', clearedAt: input.observedAt } };
}

export class MemoryZenLockStore implements ZenLockStore {
  private readonly states = new Map<string, ZenLockState>();

  get(scope: string): ZenLockState | undefined {
    const state = this.states.get(scope);
    return state && { ...state };
  }

  markExceeded(input: ExceededInput): ZenLockState {
    const state = applyExceeded(this.states.get(input.scope), input);
    if (state) this.states.set(input.scope, state);
    return { ...(state ?? this.states.get(input.scope)!) };
  }

  markOk(input: OkInput): { changed: boolean; state?: ZenLockState } {
    const result = applyOk(this.states.get(input.scope), input);
    if (result.state) this.states.set(input.scope, result.state);
    return { changed: result.changed, ...(result.state && { state: { ...result.state } }) };
  }

  close(): void {}
}
