import type { UsageResult } from "../../app/usage-source.js";
import type { ProviderId, UsageWindow } from "../../domain/usage.js";
import { expectedMetrics } from "./expected.js";
import { formatNumber, formatTimeLeft } from "./format.js";
import { displayWindows, windowLabels } from "./labels.js";

export { displayWindows, windowLabels } from "./labels.js";

export function show(metric: number | string): string {
  return typeof metric === "number" ? formatNumber(metric) : metric;
}

function value(metric: number | string | undefined): string {
  return metric === undefined ? "unknown" : show(metric);
}

function renderWindow(window: UsageWindow, observedAt: string, windows: readonly UsageWindow[],
  label: string): string {
  const left = formatTimeLeft(window.resetAt, observedAt);
  const metrics = [
    `used=${value(window.used)}`,
    `remaining=${value(window.remaining)}`,
    `limit=${value(window.limit)}`,
    `percent=${value(window.percent)}`,
    `reset=${value(window.resetAt)}`,
    `reset_in=${left?.replace(" ", "") ?? "unknown"}`,
    ...expectedMetrics(window, windows, observedAt),
  ];
  return `  - ${label} [${window.unit}] ${metrics.join(" ")}`;
}

export function visibleWindows(provider: ProviderId,
  windows: readonly UsageWindow[]): { readonly windows: readonly UsageWindow[]; readonly labels: readonly string[] } {
  const visible = displayWindows(provider, windows);
  return { windows: visible, labels: windowLabels(provider, visible) };
}

export function renderResult(result: UsageResult): string[] {
  if ("snapshot" in result) {
    const { provider, observedAt, windows } = result.snapshot;
    const { windows: visible, labels } = visibleWindows(provider, windows);
    const header = `${provider}: ok observed=${observedAt} windows=${visible.length}`;
    if (visible.length === 0) return [`${header} (no usage windows reported)`];
    return [header, ...visible.map((window, index) =>
      renderWindow(window, observedAt, visible, labels[index]!))];
  }
  return [`${result.provider}: error [${result.error.code}] ${result.error.message}`];
}

export function renderResults(results: readonly UsageResult[]): string[] {
  return results.flatMap((result) => renderResult(result));
}
