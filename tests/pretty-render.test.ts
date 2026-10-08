import assert from "node:assert/strict";
import test from "node:test";
import { SourceError, type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot } from "../src/domain/usage.js";
import { renderPretty, formatResetTime, formatUsage } from "../src/ui/cli/render.js";

const observedAt = "2026-10-07T05:30:00.000Z";

test("formatResetTime renders KST without guessing baseline", () => {
  assert.equal(formatResetTime(undefined), "-");
  assert.equal(formatResetTime("2026-10-14T00:00:00Z"), "2026-10-14 09:00");
});

test("formatUsage shows only existing metrics without unknown", () => {
  assert.equal(formatUsage({ id: "w", unit: "req", percent: 30, used: 3, limit: 10 }),
    "30% (3/10 req)");
  assert.equal(formatUsage({ id: "w", unit: "req", percent: 30 }), "30%");
  assert.equal(formatUsage({ id: "w", unit: "req", used: 5 }), "5 req");
  assert.equal(formatUsage({ id: "w", unit: "req", remaining: 2 }), "rem: 2 req");
  assert.equal(formatUsage({ id: "w", unit: "req" }), "-");
});

test("renderPretty renders structured table with header, metrics, and ok status", () => {
  const result: UsageResult = {
    provider: "codex",
    snapshot: createSnapshot("codex", observedAt, [
      { id: "weekly", unit: "requests", used: 3, remaining: 7, limit: 10,
        percent: 30, resetAt: "2026-10-14T00:00:00Z" },
    ]),
  };
  const lines = renderPretty([result]);
  const tableText = lines.join("\n");
  assert.ok(tableText.includes("Provider"));
  assert.ok(tableText.includes("Reset (KST)"));
  assert.ok(tableText.includes("codex"));
  assert.ok(tableText.includes("30% (3/10 requests)"));
  assert.ok(tableText.includes("2026-10-14 09:00"));
  assert.ok(!tableText.includes("unknown"));
});

test("renderPretty handles empty windows, partial failures, and long names cleanly", () => {
  const empty: UsageResult = {
    provider: "claude",
    snapshot: createSnapshot("claude", observedAt, []),
  };
  const fail: UsageResult = {
    provider: "ollama-pro",
    error: new SourceError("timeout"),
  };
  const longName: UsageResult = {
    provider: "agy",
    snapshot: createSnapshot("agy", observedAt, [
      { id: "very-long-window-identifier-exceeding-col-width", unit: "tokens", percent: 10 },
    ]),
  };

  const output = renderPretty([empty, fail, longName]).join("\n");
  assert.ok(output.includes("claude"));
  assert.ok(output.includes("(none)"));
  assert.ok(output.includes("ollama-pro"));
  assert.ok(output.includes("[timeout]"));
  assert.ok(output.includes("query timed out"));
  assert.ok(output.includes("agy"));
  assert.ok(output.includes("10%"));
  assert.ok(!output.includes("unknown"));
});
