import Table from "cli-table3";
import pc from "picocolors";
import type { UsageResult } from "../../app/usage-source.js";
import type { UsageWindow } from "../../domain/usage.js";
import { visibleWindows, show } from "./display.js";
import { expectedSuffix } from "./expected.js";
import { formatTimeLeft } from "./format.js";

export { renderResult, renderResults } from "./display.js";

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
  const { unit } = window;
  const [percent, used, limit, remaining] = [window.percent, window.used, window.limit, window.remaining]
    .map((m) => (m === undefined ? undefined : show(m)));
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
    colWidths: [13, 16, 22, 27, 22],
    wordWrap: true,
    style: { head: [], border: [] },
  });
  for (const r of results) {
    if ("snapshot" in r) {
      const { provider, windows, observedAt } = r.snapshot;
      const { windows: visible, labels, hidden } = visibleWindows(provider, windows);
      const okText = colors.green("ok");
      if (visible.length === 0) table.push([provider, "(none)",
        hidden > 0 ? `${hidden} hidden` : "-", "-", okText]);
      else visible.forEach((w, index) => {
        const left = formatTimeLeft(w.resetAt, observedAt);
        const reset = formatResetTime(w.resetAt) + (left ? ` (${left})` : "");
        table.push([provider, labels[index]!,
          formatUsage(w) + expectedSuffix(provider, w, visible, observedAt), reset, okText]);
      });
    } else {
      const err = colors.red(`[${r.error.code}] ${r.error.message}`);
      table.push([r.provider, "-", "-", "-", err]);
    }
  }
  return table.toString().split("\n");
}
