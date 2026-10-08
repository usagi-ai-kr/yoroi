import Table from "cli-table3";
import pc from "picocolors";
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

export function formatResetTime(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

export function formatUsage(window: UsageWindow): string {
  const { percent, used, limit, remaining, unit } = window;
  if (percent !== undefined) {
    if (used !== undefined && limit !== undefined) return `${percent}% (${used}/${limit} ${unit})`;
    if (used !== undefined) return `${percent}% (${used} ${unit})`;
    return `${percent}%`;
  }
  if (used !== undefined && limit !== undefined) return `${used}/${limit} ${unit}`;
  if (used !== undefined) return `${used} ${unit}`;
  if (remaining !== undefined) return `rem: ${remaining} ${unit}`;
  return "-";
}

export function renderPretty(results: readonly UsageResult[]): string[] {
  const useColor = Boolean(pc.isColorSupported && process.env.FORCE_COLOR !== "0");
  const colors = pc.createColors(useColor);
  const head = ["Provider", "Window", "Usage", "Reset (KST)", "Status"];
  const table = new Table({
    head: head.map((h: string) => colors.bold(h)),
    colWidths: [13, 16, 22, 18, 22],
    wordWrap: true,
    style: { head: [], border: [] },
  });
  for (const r of results) {
    if ("snapshot" in r) {
      const { provider, windows } = r.snapshot;
      const okText = colors.green("ok");
      if (windows.length === 0) table.push([provider, "(none)", "-", "-", okText]);
      else for (const w of windows) {
        table.push([provider, w.id, formatUsage(w), formatResetTime(w.resetAt), okText]);
      }
    } else {
      const err = colors.red(`[${r.error.code}] ${r.error.message}`);
      table.push([r.provider, "-", "-", "-", err]);
    }
  }
  return table.toString().split("\n");
}
