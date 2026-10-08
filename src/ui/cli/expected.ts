import type { UsageWindow } from "../../domain/usage.js";
import { formatNumber } from "./format.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CODEX_WEEK_MINUTES = 10_080;
export type QuotaKind = "monthly" | "weekly";

function codexMinutes(id: string): number | undefined {
  const match = /(?:^|:)(\d+)m$/.exec(id);
  return match ? Number(match[1]) : undefined;
}

export function quotaKind(id: string): QuotaKind | undefined {
  const parts = id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (parts.includes("monthly")) return "monthly";
  if (parts.includes("weekly")) return "weekly";
  return codexMinutes(id) === CODEX_WEEK_MINUTES ? "weekly" : undefined;
}

export function selectExpectedWindow(windows: readonly UsageWindow[]): UsageWindow | undefined {
  const monthly = windows.find((window) => quotaKind(window.id) === "monthly");
  return monthly ?? windows.find((window) => quotaKind(window.id) === "weekly");
}

function calendarMonthStart(end: Date): number {
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(end.getUTCDate(), lastDay);
  return Date.UTC(year, month - 1, day,
    end.getUTCHours(), end.getUTCMinutes(), end.getUTCSeconds(), end.getUTCMilliseconds());
}

export function expectedPercent(window: UsageWindow, observedAt: string): number | undefined {
  const kind = quotaKind(window.id);
  if (!kind || window.resetAt === undefined) return undefined;
  const end = Date.parse(window.resetAt);
  const now = Date.parse(observedAt);
  if (!Number.isFinite(end) || !Number.isFinite(now)) return undefined;
  const start = kind === "weekly" ? end - WEEK_MS : calendarMonthStart(new Date(end));
  const length = end - start;
  if (length <= 0) return undefined;
  const elapsed = ((now - start) / length) * 100;
  return Math.min(100, Math.max(0, elapsed));
}

function selectedPercent(window: UsageWindow, windows: readonly UsageWindow[],
  observedAt: string): number | undefined {
  if (selectExpectedWindow(windows) !== window) return undefined;
  return expectedPercent(window, observedAt);
}

export function expectedMetrics(window: UsageWindow, windows: readonly UsageWindow[],
  observedAt: string): string[] {
  const percent = selectedPercent(window, windows, observedAt);
  return percent === undefined ? [] : [`expected=${formatNumber(percent)}`];
}

export function expectedSuffix(window: UsageWindow, windows: readonly UsageWindow[],
  observedAt: string): string {
  const percent = selectedPercent(window, windows, observedAt);
  return percent === undefined ? "" : ` (exp ${formatNumber(percent)}%)`;
}
