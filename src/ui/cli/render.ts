import Table from "cli-table3";
import pc from "picocolors";
import type { UsageResult } from "../../app/usage-source.js";
import type { UsageWindow } from "../../domain/usage.js";
import { visibleWindows, show } from "./display.js";
import { expectedSuffix } from "./expected.js";
import { formatTimeLeft } from "./format.js";
import { usageStatus } from "./pace.js";
import type { ZenLockState } from "../../app/zen-lock-port.js";
import { zenFreeRow } from "./zen-free.js";
import { resultMeta } from "../../app/usage-result-meta.js";
import { formatDelta, formatCacheHit } from "./delta-format.js";
import { EMPTY_PRETTY_LINE, formatStatus, isShownStatus, prettyColWidths } from "./render-pretty-filter.js";

export { formatStatus };

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

export function renderPretty(results: readonly UsageResult[], zenFree?: ZenLockState | null): string[] {
  const useColor = Boolean(pc.isColorSupported && process.env.FORCE_COLOR !== "0");
  const colors = pc.createColors(useColor);
  const head = ["Provider", "Status", "Window", "Usage", "Reset (KST)"];
  const table = new Table({
    head: head.map((h: string) => colors.bold(h)),
    colWidths: prettyColWidths(zenFree !== undefined),
    wordWrap: true,
    style: { head: [], border: [] },
  });
  for (const r of results) {
    if ("snapshot" in r) {
      const { provider, windows, observedAt } = r.snapshot;
      const { windows: visible, labels, hidden } = visibleWindows(provider, windows);
      const deltas = resultMeta(r)?.deltas;
      const okText = colors.green("ok");
      const statuses = visible.map((w) => usageStatus(provider, w, visible, observedAt));
      if (visible.length === 0) table.push([provider, okText, "(none)",
        hidden > 0 ? `${hidden} hidden` : "-", "-"]);
      else visible.forEach((w, index) => {
        if (!isShownStatus(statuses[index]!)) return; // p83: n/a·optimal 행 생략(전부 생략되면 공급자 블록도 없음)
        const left = formatTimeLeft(w.resetAt, observedAt);
        const reset = formatResetTime(w.resetAt) + (left ? ` (${left})` : "");
        const status = formatStatus(useColor, statuses[index]!);
        const delta = deltas?.[w.id];
        const deltaSuffix = delta ? formatDelta(delta, w.unit) : undefined;
        table.push([provider, status, labels[index]!,
          formatUsage(w) + expectedSuffix(provider, w, visible, observedAt) +
            (deltaSuffix ? `\n(${deltaSuffix})` : ""), reset]);
      });
    } else {
      const err = colors.red(`[${r.error.code}] ${r.error.message}`);
      table.push([r.provider, err, "-", "-", "-"]);
    }
  }
  if (zenFree !== undefined) {
    const zen = zenFreeRow(zenFree);
    table.push(["opencode-zen-free", zen.status, "-", zen.detail, "-"]);
  }
  const cache = results.flatMap(r => {
    const meta = resultMeta(r)?.cache;
    return "snapshot" in r && meta?.hit ? [formatCacheHit(r.snapshot.provider, meta.ageMs)] : [];
  });
  const lines = table.length === 0 ? [EMPTY_PRETTY_LINE] : table.toString().split("\n");
  return cache.length ? [...lines, `cache: ${cache.join(", ")}`] : lines;
}
