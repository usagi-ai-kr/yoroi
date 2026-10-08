import type { UsageResult } from "../../app/usage-source.js";
import type { ProviderId, UsageWindow } from "../../domain/usage.js";
import { expectedMetrics } from "./expected.js";
import { formatNumber, formatTimeLeft } from "./format.js";
import { displayWindows, windowLabels } from "./labels.js";
import { usageStatus } from "./pace.js";

export { displayWindows, windowLabels } from "./labels.js";

export function show(metric: number | string): string {
  return typeof metric === "number" ? formatNumber(metric) : metric;
}

function value(metric: number | string | undefined): string {
  return metric === undefined ? "unknown" : show(metric);
}

function renderWindow(provider: ProviderId, window: UsageWindow, observedAt: string,
  windows: readonly UsageWindow[], label: string): string {
  const left = formatTimeLeft(window.resetAt, observedAt);
  const metrics = [
    `used=${value(window.used)}`,
    `remaining=${value(window.remaining)}`,
    `limit=${value(window.limit)}`,
    `percent=${value(window.percent)}`,
    `reset=${value(window.resetAt)}`,
    `reset_in=${left?.replace(" ", "") ?? "unknown"}`,
    ...expectedMetrics(provider, window, windows, observedAt),
    `usage_status=${usageStatus(provider, window, windows, observedAt)}`,
  ];
  return `  - ${label} [${window.unit}] ${metrics.join(" ")}`;
}

export interface VisibleWindows {
  readonly windows: readonly UsageWindow[];
  readonly labels: readonly string[];
  readonly hidden: number;
}

export function visibleWindows(provider: ProviderId,
  windows: readonly UsageWindow[]): VisibleWindows {
  const visible = displayWindows(provider, windows);
  return { windows: visible, labels: windowLabels(provider, visible),
    hidden: windows.length - visible.length };
}

export function renderResult(result: UsageResult): string[] {
  if ("snapshot" in result) {
    const { provider, observedAt, windows } = result.snapshot;
    const { windows: visible, labels, hidden } = visibleWindows(provider, windows);
    const header = `${provider}: ok observed=${observedAt} windows=${visible.length}`;
    if (visible.length === 0) {
      return [hidden > 0 ? `${header} (${hidden} windows hidden)` :
        `${header} (no usage windows reported)`];
    }
    return [header, ...visible.map((window, index) =>
      renderWindow(provider, window, observedAt, visible, labels[index]!))];
  }
  return [`${result.provider}: error [${result.error.code}] ${result.error.message}`];
}

export function renderResults(results: readonly UsageResult[]): string[] {
  return results.flatMap((result) => renderResult(result));
}
