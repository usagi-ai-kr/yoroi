import type { DiscoveredModel, ModelRegistrySnapshot } from './model-discovery-types.js';

/** last-good 보존 기간(확정 결정: 30일 기본, config 노출 없음). */
export const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** 스냅샷 판정 사유. */
export type SnapshotReason = 'usable' | 'missing' | 'expired' | 'future' | 'invalid' | 'failed';

export interface SnapshotSelection {
  readonly snapshot: ModelRegistrySnapshot | undefined;
  readonly reason: SnapshotReason;
}

/** 수집 결과. 실패는 예외가 아니라 값으로 다룬다. */
export type CollectionResult =
  | { readonly ok: true; readonly models: readonly DiscoveredModel[]; readonly observedAt: string }
  | { readonly ok: false; readonly error: string };

export interface SnapshotResolution {
  readonly snapshot: ModelRegistrySnapshot | undefined;
  readonly reason: SnapshotReason;
  /** 세대가 바뀌었는지(실패·무효·미래·만료 회차는 false). */
  readonly changed: boolean;
}

/** ISO instant → epoch ms. 파싱 불가면 undefined. */
export function parseInstant(value: string): number | undefined {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : undefined;
}

/** 스냅샷 사용 가능 여부. nowMs가 유한하지 않으면 판정 불가(invalid).
 *  30일 경계는 유효(정확히 30일=usable, 1ms 초과=expired), 미래 시각·형식 오류·세대 0 이하는 fail-closed 거부. */
export function selectSnapshot(candidate: ModelRegistrySnapshot | undefined, nowMs: number): SnapshotSelection {
  if (!Number.isFinite(nowMs)) return { snapshot: undefined, reason: 'invalid' };
  if (candidate === undefined) return { snapshot: undefined, reason: 'missing' };
  if (!Number.isInteger(candidate.generation) || candidate.generation < 1) return { snapshot: undefined, reason: 'invalid' };
  const observedAtMs = parseInstant(candidate.observedAt);
  if (observedAtMs === undefined) return { snapshot: undefined, reason: 'invalid' };
  if (observedAtMs > nowMs) return { snapshot: undefined, reason: 'future' };
  if (nowMs - observedAtMs > SNAPSHOT_MAX_AGE_MS) return { snapshot: undefined, reason: 'expired' };
  return { snapshot: candidate, reason: 'usable' };
}

/** 다음 세대 스냅샷. 관측시각이 미래·무효·30일 초과면 거부한다(만료 관측을 usable로 만들지 않는다).
 *  세대 승계는 같은 provider의 직전 스냅샷에서만 한다(다른 provider 세대를 물려받지 않는다). */
export function buildSnapshot(previous: ModelRegistrySnapshot | undefined, providerId: string,
  models: readonly DiscoveredModel[], observedAt: string, nowMs: number): SnapshotSelection {
  if (!Number.isFinite(nowMs)) return { snapshot: undefined, reason: 'invalid' };
  const observedAtMs = parseInstant(observedAt);
  if (observedAtMs === undefined) return { snapshot: undefined, reason: 'invalid' };
  if (observedAtMs > nowMs) return { snapshot: undefined, reason: 'future' };
  if (nowMs - observedAtMs > SNAPSHOT_MAX_AGE_MS) return { snapshot: undefined, reason: 'expired' };
  const prevGen = previous !== undefined && previous.providerId === providerId ? previous.generation : 0;
  const inherited = Number.isInteger(prevGen) && prevGen >= 1 ? prevGen : 0;
  const sorted = [...models].sort((a, b) => a.modelId.localeCompare(b.modelId));
  return { snapshot: { generation: inherited + 1, observedAt, providerId, models: sorted }, reason: 'usable' };
}

/** 직전 스냅샷이 요청 provider의 것일 때만 last-good 후보가 된다(다른 provider 세대를 넘기지 않는다). */
function lastGoodFor(current: ModelRegistrySnapshot | undefined, providerId: string, nowMs: number): SnapshotSelection {
  if (current === undefined || current.providerId !== providerId) return { snapshot: undefined, reason: 'missing' };
  return selectSnapshot(current, nowMs);
}

/** 한 회차 수집 결과를 현재 세대에 반영한다. 수집 실패·무효·미래·만료 회차는 유효 last-good을 그대로 유지한다
 *  (fail-closed: 세대 교체 없음 → 노출 목록 불변). 회차 사유는 보존된 last-good과 별개로 그대로 알린다. */
export function resolveCollection(current: ModelRegistrySnapshot | undefined, providerId: string,
  result: CollectionResult, nowMs: number): SnapshotResolution {
  const lastGood = lastGoodFor(current, providerId, nowMs);
  if (!result.ok) {
    return { snapshot: lastGood.snapshot, reason: lastGood.snapshot === undefined ? lastGood.reason : 'failed', changed: false };
  }
  const built = buildSnapshot(current, providerId, result.models, result.observedAt, nowMs);
  if (built.snapshot === undefined) {
    return { snapshot: lastGood.snapshot, reason: built.reason, changed: false };
  }
  return { snapshot: built.snapshot, reason: built.reason, changed: true };
}
