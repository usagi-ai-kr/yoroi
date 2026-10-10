import type { ZenLockState } from '../../app/zen-lock-port.js';

function safeText(value: string, limit: number): string {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, limit);
}

export function zenFreeRow(state?: ZenLockState | null, now: Date = new Date()): { status: string; detail: string } {
  if (!state) return { status: 'unknown', detail: 'no local status' };
  const retryPassed = state.state === 'locked' && state.retryAt !== undefined &&
    Number.isFinite(Date.parse(state.retryAt)) && Date.parse(state.retryAt) < now.getTime();
  const parts = [state.model && safeText(state.model, 64), state.reason && `reason=${safeText(state.reason, 120)}`,
    state.state === 'locked' && state.retryAt && `retry=${safeText(state.retryAt, 40)}`,
    retryPassed && 'retry passed (unverified)'].filter(Boolean);
  return { status: state.state, detail: parts.join(' ') || '-' };
}

export function renderZenFreeStatus(state?: ZenLockState | null, now: Date = new Date()): string {
  const row = zenFreeRow(state, now);
  return `opencode-zen-free: ${row.status} ${row.detail}`.trimEnd();
}
