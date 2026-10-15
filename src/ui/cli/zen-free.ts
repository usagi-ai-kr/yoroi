import type { ZenLockState } from '../../app/zen-lock-port.js';
import { formatTimeLeft } from './format.js';

function safeText(value: string, limit: number): string {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, limit);
}

function formatElapsedMinutes(minutes: number): string {
  const d = Math.floor(minutes / 1440), h = Math.floor((minutes % 1440) / 60), m = minutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export interface ZenFreeRow {
  status: string; detail: string; resetAt?: string; resetPassed?: boolean; timeLeft?: string | undefined;
}

export function zenFreeRow(state?: ZenLockState | null, now: Date = new Date()): ZenFreeRow {
  if (!state) return { status: 'unknown', detail: 'no local status' };
  const hasRetry = state.state === 'locked' && state.retryAt !== undefined && Number.isFinite(Date.parse(state.retryAt));
  const retryPassed = hasRetry && Date.parse(state.retryAt!) < now.getTime();
  const timeLeft = hasRetry && !retryPassed ? formatTimeLeft(state.retryAt, now) : undefined;
  const lockStart = state.state === 'locked' ? (state.lockedAt ?? state.updatedAt) : undefined;
  const lockStartTs = lockStart ? Date.parse(lockStart) : NaN;
  const lockedFor = Number.isFinite(lockStartTs)
    ? formatElapsedMinutes(Math.max(0, Math.floor((now.getTime() - lockStartTs) / 60_000))) : undefined;
  const parts = [state.model && safeText(state.model, 64), state.reason && `reason=${safeText(state.reason, 120)}`,
    lockedFor && `locked_for=${lockedFor.replace(/\s+/g, '')}`,
    state.state === 'locked' && state.retryAt && `retry=${safeText(state.retryAt, 40)}`,
    timeLeft && `retry_in=${timeLeft.replace(/\s+/g, '')}`,
    retryPassed && 'retry passed (unverified)'].filter(Boolean);
  return {
    status: state.state, detail: parts.join(' ') || '-',
    ...(hasRetry && { resetAt: state.retryAt, resetPassed: retryPassed, timeLeft }),
  };
}

export interface ZenFreeJsonStatus {
  state: 'locked' | 'clear' | 'unknown'; model: string | null; lockedForSeconds: number | null;
  retryAt: string | null; retryPassed: boolean; retryInSeconds: number | null;
  updatedAt: string | null; loadedAt: string | null;
}

function safeIso(value?: string): string | null {
  if (!value || value.length > 64) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function zenFreeJsonStatus(state?: ZenLockState | null, now: Date = new Date(), loadedAt?: string): ZenFreeJsonStatus {
  const model = state?.model && safeText(state.model, 64);
  const safeModel = model && /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,63}$/.test(model) ? model : null;
  const lockStart = state?.state === 'locked' ? (state.lockedAt ?? state.updatedAt) : undefined;
  const lockStartTs = lockStart ? Date.parse(lockStart) : NaN;
  const lockedForSeconds = Number.isFinite(lockStartTs)
    ? Math.max(0, Math.floor((now.getTime() - lockStartTs) / 1000)) : null;
  const retryAt = state?.state === 'locked' ? safeIso(state.retryAt) : null;
  const diffMs = retryAt !== null ? Date.parse(retryAt) - now.getTime() : null;
  const retryInSeconds = diffMs !== null ? (diffMs > 0 ? Math.ceil(diffMs / 1000) : null) : null;
  return { state: state?.state ?? 'unknown', model: safeModel, lockedForSeconds, retryAt,
    retryPassed: retryAt !== null && Date.parse(retryAt) < now.getTime(), retryInSeconds,
    updatedAt: safeIso(state?.updatedAt), loadedAt: safeIso(loadedAt) };
}

export function renderZenFreeStatus(state?: ZenLockState | null, now: Date = new Date()): string {
  const row = zenFreeRow(state, now);
  return `opencode-zen-free: ${row.status} ${row.detail}`.trimEnd();
}

/** `zen-free` 명령 전용 출력: 상태 한 줄 + 마지막 플러그인 로드 시각(미기록은 명시). `once` 행에는 쓰지 않는다. */
export function renderZenFreeCommand(state?: ZenLockState | null, loadedAt?: string, now: Date = new Date()): string {
  return `${renderZenFreeStatus(state, now)}\nplugin-loaded: ${safeIso(loadedAt) ?? 'not recorded'}`;
}
