import { parseRetryAfter } from '../domain/retry-after.js';

export interface RequestPolicy {
  readonly maxRetries: number;
  readonly maxRequests: number;
  readonly budgetMs: number;
  readonly retryDelayMs: number;
}
export const DEFAULT_REQUEST_POLICY: Readonly<RequestPolicy> = Object.freeze({
  maxRetries: 1, maxRequests: 10, budgetMs: 60_000, retryDelayMs: 1000,
});
/** One source per execution; counters include all pages and retries already attempted. */
export interface RequestState {
  readonly startedAtMs: number;
  readonly nowMs: number;
  readonly requestsMade: number;
  readonly retriesMade: number;
  readonly cancelled?: boolean;
}
export interface RetryState extends RequestState {
  readonly retryable: boolean;
  readonly retryAfter?: string;
}
export type RequestDecision =
  | { readonly allowed: true; readonly waitMs: number; readonly timeoutMs: number }
  | { readonly allowed: false; readonly reason: 'cancelled' | 'invalid-state' | 'request-limit' |
      'retry-limit' | 'not-retryable' | 'budget-exhausted' };

function policyWith(overrides: Partial<RequestPolicy>): RequestPolicy {
  const policy = { ...DEFAULT_REQUEST_POLICY, ...overrides };
  if (Object.values(policy).some(n => !Number.isSafeInteger(n) || n < 0) || policy.budgetMs < 1) {
    throw new RangeError('Invalid insight request policy');
  }
  return policy;
}
function gate(state: RequestState, policy: RequestPolicy, waitMs: number): RequestDecision {
  if (state.cancelled) return { allowed: false, reason: 'cancelled' };
  if ([state.startedAtMs, state.nowMs, state.requestsMade, state.retriesMade]
    .some(n => !Number.isSafeInteger(n) || n < 0) || state.nowMs < state.startedAtMs) {
    return { allowed: false, reason: 'invalid-state' };
  }
  if (state.requestsMade >= policy.maxRequests) return { allowed: false, reason: 'request-limit' };
  const remaining = policy.budgetMs - (state.nowMs - state.startedAtMs);
  // Equality also stops: waiting until the deadline leaves no time for a request.
  if (waitMs >= remaining) return { allowed: false, reason: 'budget-exhausted' };
  return { allowed: true, waitMs, timeoutMs: remaining - waitMs };
}
/** Check before every HTTP attempt, including pagination. Caller increments requestsMade
 * before dispatch and clamps HTTP timeout to timeoutMs; this function never mutates counters. */
export function decideRequest(state: RequestState,
  overrides: Partial<RequestPolicy> = {}): RequestDecision {
  return gate(state, policyWith(overrides), 0);
}
/** Retry count is source-wide, not reset for each page. Caller classifies the failure,
 * waits if allowed, then rechecks decideRequest with a fresh clock before dispatch. */
export function decideRetry(state: RetryState,
  overrides: Partial<RequestPolicy> = {}): RequestDecision {
  const policy = policyWith(overrides);
  const immediate = gate(state, policy, 0);
  if (!immediate.allowed) return immediate;
  if (!state.retryable) return { allowed: false, reason: 'not-retryable' };
  if (state.retriesMade >= policy.maxRetries) return { allowed: false, reason: 'retry-limit' };
  return gate(state, policy, parseRetryAfter(state.retryAfter, state.nowMs) ?? policy.retryDelayMs);
}
