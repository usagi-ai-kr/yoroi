import type { ZenDetectEvent } from './detect-events.js';
import { safeModelId } from './detect-events.js';
import { detectKeys, readState, writeState, type DetectStateStore } from './detect-state-port.js';
import { ZEN_FREE_SCOPE, type ZenLockStore } from './zen-lock-port.js';

export interface ZenDetectInput {
  readonly lock: ZenLockStore;
  readonly state: DetectStateStore;
  readonly nowMs: number;
  /** The newest OpenCode process start (ms); without it plugin staleness cannot be judged. */
  readonly opencodeStartedAtMs?: number;
  /** Grace after an OpenCode start before a missing load mark counts as stale. */
  readonly pluginStaleGraceMs: number;
  /** 설치 타깃(p43, YOROI_OPENCODE_TARGET로 주입 예정): v2면 ps 대신 마커 버전으로만 판정. 기본 v1. */
  readonly target?: 'v1' | 'v2';
}

const iso = (ms: number): string => new Date(ms).toISOString();
const safeIso = (value?: string): string | undefined => {
  const ms = value === undefined ? Number.NaN : Date.parse(value);
  return Number.isFinite(ms) ? iso(ms) : undefined;
};
const MINUTE = 60_000;
/** Process start times come from elapsed seconds, so they jitter by up to a second between cycles: identity and
 * comparisons use the whole minute (a load in the same minute as the start counts as loaded). */
const minuteOf = (ms: number): number => Math.floor(ms / MINUTE) * MINUTE;
const isCursor = (v: unknown): v is { id: number } => typeof v === 'object' && v !== null && Number.isSafeInteger((v as { id?: unknown }).id);
const isMark = (v: unknown): v is { mark: string } => typeof v === 'object' && v !== null && typeof (v as { mark?: unknown }).mark === 'string';

/** Reads only local DB state (no network, no OpenCode logs or conversations). Events carry ids, safe model
 * ids and ISO times. Delivery is at-most-once: the cursor and dedupe marks are persisted before returning,
 * so a restart never repeats an event (a crash before printing loses it; `zen-free status` still shows it). */
export function detectZen(input: ZenDetectInput): readonly ZenDetectEvent[] {
  const { lock, state, nowMs, opencodeStartedAtMs, pluginStaleGraceMs, target = 'v1' } = input;
  if (!Number.isFinite(nowMs) || !(pluginStaleGraceMs >= 0)) throw new RangeError('Invalid zen detect input');
  const events: ZenDetectEvent[] = [];
  const observedAt = iso(nowMs);
  if (lock.eventsSince && lock.latestEventId) {
    const latest = lock.latestEventId(ZEN_FREE_SCOPE);
    const cursor = readState(state, detectKeys.zen('cursor'), isCursor)?.id;
    if (cursor === undefined || cursor > latest) writeState(state, detectKeys.zen('cursor'), { id: latest }); // first run or reset DB: no replay
    else if (cursor < latest) {
      const rows = lock.eventsSince(ZEN_FREE_SCOPE, cursor);
      for (const row of rows) {
        const model = safeModelId(row.model), at = safeIso(row.observedAt), retryAt = safeIso(row.retryAt);
        if (!at) continue;
        events.push(row.kind === 'exceeded'
          ? { kind: 'exceeded', eventId: row.id, observedAt: at, ...(model && { model }), ...(retryAt && { retryAt }) }
          : { kind: 'cleared', eventId: row.id, observedAt: at, ...(model && { model }) });
      }
      writeState(state, detectKeys.zen('cursor'), { id: rows.at(-1)?.id ?? latest });
    }
  }
  const lockState = lock.get(ZEN_FREE_SCOPE), retryAt = safeIso(lockState?.retryAt);
  if (lockState?.state === 'locked' && retryAt && Date.parse(retryAt) < nowMs) {
    if (readState(state, detectKeys.zen('retry-passed'), isMark)?.mark !== retryAt) {
      writeState(state, detectKeys.zen('retry-passed'), { mark: retryAt });
      const model = safeModelId(lockState.model);
      events.push({ kind: 'retry-passed', observedAt, retryAt, ...(model && { model }) });
    }
  } else if (state.get(detectKeys.zen('retry-passed')) !== undefined) state.delete(detectKeys.zen('retry-passed'));
  const loadedAt = safeIso(lock.loadedAt?.(ZEN_FREE_SCOPE));
  if (target === 'v2') {
    // p43: V2는 공용 백그라운드 서비스라 ps 시작 시각을 stale 근거로 쓰지 않는다. 설치 마커(v2)와
    // 마지막 loaded 버전이 다르면(미로드 포함) stale이고, 맞으면 이전 판정을 해제한다.
    const loadedVersion = lock.loadedVersion?.(ZEN_FREE_SCOPE);
    const mark = `v2|${loadedVersion ?? 'never'}`;
    if (loadedVersion !== 'v2') {
      if (readState(state, detectKeys.zen('plugin-stale'), isMark)?.mark !== mark) {
        writeState(state, detectKeys.zen('plugin-stale'), { mark });
        events.push({ kind: 'plugin-stale', observedAt, marker: 'v2', ...(loadedAt && { loadedAt }) });
      }
    } else if (state.get(detectKeys.zen('plugin-stale')) !== undefined) state.delete(detectKeys.zen('plugin-stale'));
    return events;
  }
  const startMinute = opencodeStartedAtMs === undefined ? undefined : minuteOf(opencodeStartedAtMs);
  const stale = startMinute !== undefined && nowMs - opencodeStartedAtMs! >= pluginStaleGraceMs &&
    (loadedAt === undefined || Date.parse(loadedAt) < startMinute);
  if (stale) {
    const processStartedAt = iso(startMinute!);
    // Dedupe on the load state, not on "now": a detector restart under pm2 re-reads the same OpenCode start (to the
    // minute, +/- one minute at a minute edge) and the same load mark, so this stays silent; a new OpenCode that never
    // loaded, or a load mark that moved, is a genuinely new condition.
    const prior = readState(state, detectKeys.zen('plugin-stale'), isMark)?.mark.split('|');
    const same = prior !== undefined && prior[1] === (loadedAt ?? 'never') && Math.abs(Date.parse(prior[0]!) - startMinute!) <= MINUTE;
    if (!same) {
      writeState(state, detectKeys.zen('plugin-stale'), { mark: `${processStartedAt}|${loadedAt ?? 'never'}` });
      events.push({ kind: 'plugin-stale', observedAt, processStartedAt, ...(loadedAt && { loadedAt }) });
    }
  } else if (opencodeStartedAtMs !== undefined && state.get(detectKeys.zen('plugin-stale')) !== undefined) state.delete(detectKeys.zen('plugin-stale'));
  return events;
}
