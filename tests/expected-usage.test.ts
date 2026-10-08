import assert from "node:assert/strict";
import test from "node:test";
import { type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot, type UsageWindow } from "../src/domain/usage.js";
import { expectedMetrics, expectedPercent, expectedSuffix, quotaKind } from "../src/ui/cli/expected.js";
import { formatNumber } from "../src/ui/cli/format.js";
import { renderPretty, renderResults } from "../src/ui/cli/render.js";

const observedAt = "2026-10-04T00:00:00.000Z";
const win = (window: Partial<UsageWindow> & { id: string }): UsageWindow =>
  ({ unit: "percent", ...window });

test("quotaKind classifies only monthly, weekly, and codex seven-day windows", () => {
  assert.equal(quotaKind("monthly"), "monthly");
  assert.equal(quotaKind("weekly"), "weekly");
  assert.equal(quotaKind("weekly:7d"), "weekly");
  assert.equal(quotaKind("weekly:sonnet:7d"), "weekly");
  assert.equal(quotaKind("claude-and-gpt-models:weekly-limit-remaining"), "weekly");
  assert.equal(quotaKind("codex:secondary:10080m"), "weekly");
  assert.equal(quotaKind("rolling"), undefined);
  assert.equal(quotaKind("session:5h"), undefined);
  assert.equal(quotaKind("codex:primary:300m"), undefined);
  assert.equal(quotaKind("gemini-models:five-hour-limit-remaining"), undefined);
  assert.equal(quotaKind("activity:last-4-weeks"), undefined);
});

test("weekly expected is the elapsed share of seven days formatted to 2dp ceiling", () => {
  const weekly = win({ id: "weekly", resetAt: "2026-10-08T00:00:00.000Z" });

  assert.equal(formatNumber(expectedPercent(weekly, observedAt)!), "42.86");
  assert.deepEqual(expectedMetrics(weekly, [weekly], observedAt), ["expected=42.86"]);
  assert.equal(expectedSuffix(weekly, [weekly], observedAt), " (exp 42.86%)");
});

test("monthly expected spans the calendar month before reset with clamping", () => {
  const monthly = win({ id: "monthly", resetAt: "2026-11-07T00:00:00.000Z" });
  const monthEnd = win({ id: "monthly", resetAt: "2027-03-31T00:00:00.000Z" });

  assert.equal(formatNumber(expectedPercent(monthly, "2026-10-27T00:00:00.000Z")!), "64.52");
  assert.equal(formatNumber(expectedPercent(monthEnd, "2027-03-15T00:00:00.000Z")!), "48.39");
  assert.equal(formatNumber(expectedPercent(monthly, "2026-09-30T00:00:00.000Z")!), "0");
  assert.equal(formatNumber(expectedPercent(monthly, "2026-12-01T00:00:00.000Z")!), "100");
});

test("expected needs a reset time and only marks the longest selected window", () => {
  const weekly = win({ id: "weekly", resetAt: "2026-10-08T00:00:00.000Z" });
  const monthly = win({ id: "monthly", resetAt: "2026-11-07T00:00:00.000Z" });

  assert.equal(expectedPercent(win({ id: "weekly" }), observedAt), undefined);
  assert.deepEqual(expectedMetrics(win({ id: "weekly" }), [win({ id: "weekly" })], observedAt), []);
  assert.equal(expectedSuffix(weekly, [weekly, monthly], observedAt), "");
  assert.equal(expectedSuffix(monthly, [weekly, monthly], observedAt), " (exp 0%)");
});

test("plain output adds expected to monthly over weekly and keeps other lines unchanged", () => {
  const result: UsageResult = { provider: "opencode-go", snapshot: createSnapshot("opencode-go", observedAt, [
    win({ id: "rolling", percent: 4, resetAt: "2026-10-04T05:00:00.000Z" }),
    win({ id: "weekly", percent: 3, resetAt: "2026-10-08T00:00:00.000Z" }),
    win({ id: "monthly", percent: 10, resetAt: "2026-11-07T00:00:00.000Z" }),
  ]) };
  const lines = renderResults([result]);

  assert.equal(lines.filter((line) => line.includes("expected=")).length, 1);
  assert.ok(lines[1]!.endsWith("reset_in=5h0m"));
  assert.ok(lines[2]!.endsWith("reset_in=4d0h"));
  assert.ok(lines[3]!.endsWith("expected=0"));
});

test("plain output falls back to the weekly window when no monthly window exists", () => {
  const result: UsageResult = { provider: "claude", snapshot: createSnapshot("claude", observedAt, [
    win({ id: "session:5h", percent: 30, resetAt: "2026-10-04T05:00:00.000Z" }),
    win({ id: "weekly:7d", percent: 12, resetAt: "2026-10-08T00:00:00.000Z" }),
    win({ id: "weekly:sonnet:7d", percent: 20, resetAt: "2026-10-08T00:00:00.000Z" }),
  ]) };
  const marked = renderResults([result]).filter((line) => line.includes("expected="));

  assert.equal(marked.length, 1);
  assert.match(marked[0]!, /- weekly:7d \[percent\]/);
});

test("pretty output appends exp once and keeps every table line the same width", () => {
  const result: UsageResult = { provider: "opencode-go", snapshot: createSnapshot("opencode-go", observedAt, [
    win({ id: "rolling", percent: 4, resetAt: "2026-10-04T05:00:00.000Z" }),
    win({ id: "weekly", percent: 12, resetAt: "2026-10-08T00:00:00.000Z" }),
  ]) };
  const lines = renderPretty([result]);
  const text = lines.join("\n");

  assert.equal(text.split("(exp").length - 1, 1);
  assert.ok(text.includes("12% (exp 42.86%)"));
  assert.equal(new Set(lines.map((line) => line.length)).size, 1);
});
