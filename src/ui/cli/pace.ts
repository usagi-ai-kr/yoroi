import type { ProviderId, UsageWindow } from "../../domain/usage.js";
import { selectedExpectedPercent } from "./expected.js";

export type UsageStatus = "under" | "optimal" | "over" | "n/a";

const TOLERANCE_PERCENT = 3;

function actualPercent(window: UsageWindow): number | undefined {
  if (window.percent !== undefined) return window.percent;
  if (window.used !== undefined && window.limit !== undefined && window.limit > 0) {
    return (window.used / window.limit) * 100;
  }
  return undefined;
}

/**
 * 실제 사용률과 예상 균등 사용량을 비교한다.
 * |실제-예상| <= 3%p면 optimal(경계 포함), 미만이면 under, 초과면 over, 예상·실제를 못 구하면 n/a.
 */
export function usageStatus(provider: ProviderId, window: UsageWindow,
  windows: readonly UsageWindow[], observedAt: string): UsageStatus {
  const expected = selectedExpectedPercent(provider, window, windows, observedAt);
  if (expected === undefined) return "n/a";
  const actual = actualPercent(window);
  if (actual === undefined) return "n/a";
  const diff = actual - expected;
  if (Math.abs(diff) <= TOLERANCE_PERCENT) return "optimal";
  return diff < 0 ? "under" : "over";
}
