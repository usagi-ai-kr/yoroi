import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { SourceError, type UsageResult } from "../src/app/usage-source.js";
import type { MeteredUsageResult } from "../src/app/usage-result-meta.js";
import { createSnapshot, type UsageWindow } from "../src/domain/usage.js";
import { renderPretty } from "../src/ui/cli/render.js";
import { EMPTY_PRETTY_LINE, prettyColWidths } from "../src/ui/cli/render-pretty-filter.js";
import { visibleWindows } from "../src/ui/cli/display.js";
import { usageStatus } from "../src/ui/cli/pace.js";

/** 기본 pretty 표는 under·n/a·optimal 창만 남기고 over·limit는 생략한다. 픽스처는 opencode-go, 관측 시각 고정. */
const observedAt = "2026-10-07T05:30:00.000Z";
const weekly = (percent: number): UsageWindow => ({ id: "weekly", unit: "percent", percent, resetAt: "2026-10-08T00:00:00.000Z" });
const monthly = (percent: number, resetAt: string): UsageWindow => ({ id: "monthly", unit: "percent", percent, resetAt });
const rolling = (percent: number, resetAt?: string): UsageWindow => ({ id: "rolling", unit: "percent", percent, ...(resetAt && { resetAt }) });
const OVER = monthly(70, "2026-11-07T00:00:00.000Z");
const LIMIT = rolling(99, "2026-10-07T09:00:00.000Z");
const result = (provider: "opencode-go" | "codex", windows: UsageWindow[]): UsageResult =>
  ({ provider, snapshot: createSnapshot(provider, observedAt, windows) });
const text = (lines: readonly string[]): string => stripVTControlCharacters(lines.join("\n"));
const widths = (lines: readonly string[]): number[] => lines.map((line) => stripVTControlCharacters(line).length);
/** 표에 쓰이는 라벨별 상태(같은 공급자의 창끼리 문맥에 따라 상태가 달라지므로 픽스처 전제를 테스트 안에서 고정한다). */
const labelled = (windows: UsageWindow[]): Record<string, string> => {
  const { windows: visible, labels } = visibleWindows("opencode-go", windows);
  return Object.fromEntries(visible.map((w, i) => [labels[i]!, usageStatus("opencode-go", w, visible, observedAt)]));
};

test("over and limit rows are removed while under, n/a, optimal stay", () => {
  const windows = [weekly(3), rolling(40)];
  assert.deepEqual(labelled(windows), { w: "under", "5h": "n/a" });
  assert.deepEqual(labelled([OVER]), { m: "over" });
  const out = text(renderPretty([result("opencode-go", windows), result("opencode-go", [OVER])]));
  assert.match(out, /│ opencode-go │ ok under\s*│ w\s*│/);
  assert.match(out, /│ opencode-go │ ok n\/a\s*│ 5h\s*│/);
  assert.ok(!out.includes("ok over") && !out.includes(" m "), out);
  assert.deepEqual(labelled([weekly(89)]), { w: "optimal" });
  const optOut = text(renderPretty([result("opencode-go", [weekly(89)])]));
  assert.match(optOut, /│ opencode-go │ ok optimal\s*│ w\s*│/);
});

test("under, n/a, optimal rows are kept while over and limit are omitted", () => {
  const first = [weekly(3), LIMIT];
  assert.deepEqual(labelled(first), { w: "under", "5h": "limit" });
  assert.deepEqual(labelled([OVER]), { m: "over" });
  const out = text(renderPretty([result("opencode-go", first), result("opencode-go", [OVER])]));
  assert.match(out, /ok under\s*│ w\s*│/);
  assert.ok(!out.includes("ok over"), "over is hidden");
  assert.ok(!out.includes("ok limit"), "limit is hidden");
});

test("when all windows of a provider are hidden a summary row remains", () => {
  const out = text(renderPretty([result("opencode-go", [OVER, LIMIT])]));
  assert.match(out, /opencode-go\s*│ ok\s*│ -\s*│ 숨김 2개\(over\/limit\)\s*│ -/);
  assert.deepEqual(renderPretty([]), [EMPTY_PRETTY_LINE]);
});

test("a provider with all windows hidden displays 숨김 n개(over/limit) row while others stay", () => {
  const out = text(renderPretty([result("codex", [OVER]), result("opencode-go", [weekly(3)])]));
  assert.match(out, /codex\s*│ ok\s*│ -\s*│ 숨김 1개\(over\/limit\)\s*│ -/);
  assert.match(out, /│ opencode-go │ ok under\s*│ w\s*│/);
});

test("other structures stay: error rows, the (none) row, zen-free row and the cache line", () => {
  const fail: UsageResult = { provider: "ollama-pro", error: new SourceError("timeout") };
  const empty = result("codex", []);
  const hit: MeteredUsageResult = { ...result("opencode-go", [weekly(3)]), meta: { cache: { hit: true, ageMs: 30_000 } } };
  const out = text(renderPretty([fail, empty, hit]));
  assert.ok(out.includes("[timeout]") && out.includes("(none)") && out.includes("cache: "), out);
  assert.ok(!out.includes(EMPTY_PRETTY_LINE), "오류·(none) 행이 있으면 표를 유지한다");
  const zen = renderPretty([], { scope: "z", state: "clear", updatedAt: observedAt });
  assert.ok(text(zen).includes("opencode-zen-free") && !text(zen).includes(EMPTY_PRETTY_LINE), "zen-free 행은 항상 표를 남긴다");
  assert.deepEqual(renderPretty([hit]).filter((line) => line.startsWith("cache: ")).length, 1);
  assert.deepEqual(renderPretty([]), [EMPTY_PRETTY_LINE]);
});

test("column widths depend on structure, not on how many rows were omitted", () => {
  const all = renderPretty([result("opencode-go", [weekly(3), rolling(40)])]);
  const one = renderPretty([result("opencode-go", [weekly(3), OVER])]);
  assert.equal(new Set(widths(all)).size, 1);
  assert.deepEqual(widths(one), widths(one).map(() => widths(all)[0]!), "행 수가 달라도 같은 폭·정렬");
  const zen = renderPretty([result("opencode-go", [weekly(3)])], { scope: "z", state: "clear", updatedAt: observedAt });
  assert.equal(new Set(widths(zen)).size, 1);
  assert.equal(widths(zen)[0]! - widths(one)[0]!, 7, "zen-free가 있을 때만 Provider 열이 13→20");
  assert.deepEqual([prettyColWidths(false), prettyColWidths(true)], [[13, 22, 16, 22, 27], [20, 22, 16, 22, 27]]);
});
