import type { UsageResult } from "../../app/usage-source.js";
import type { UsageWindow } from "../../domain/usage.js";

function value(metric: number | string | undefined): string {
  return metric === undefined ? "unknown" : String(metric);
}

function renderWindow(window: UsageWindow): string {
  const metrics = [
    `used=${value(window.used)}`,
    `remaining=${value(window.remaining)}`,
    `limit=${value(window.limit)}`,
    `percent=${value(window.percent)}`,
    `reset=${value(window.resetAt)}`,
  ];
  return `  - ${window.id} [${window.unit}] ${metrics.join(" ")}`;
}

export function renderResult(result: UsageResult): string[] {
  if ("snapshot" in result) {
    const { provider, observedAt, windows } = result.snapshot;
    const header = `${provider}: ok observed=${observedAt} windows=${windows.length}`;
    if (windows.length === 0) return [`${header} (no usage windows reported)`];
    return [header, ...windows.map((window) => renderWindow(window))];
  }
  return [`${result.provider}: error [${result.error.code}] ${result.error.message}`];
}

export function renderResults(results: readonly UsageResult[]): string[] {
  return results.flatMap((result) => renderResult(result));
}
