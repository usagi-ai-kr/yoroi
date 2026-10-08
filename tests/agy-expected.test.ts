import assert from "node:assert/strict";
import test from "node:test";
import { type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot, type UsageWindow } from "../src/domain/usage.js";
import { renderPretty, renderResults } from "../src/ui/cli/render.js";

const observedAt = "2026-10-04T00:00:00.000Z";
const win = (window: Partial<UsageWindow> & { id: string }): UsageWindow =>
  ({ unit: "percent", ...window });

const agy: UsageResult = { provider: "agy", snapshot: createSnapshot("agy", observedAt, [
  win({ id: "gemini-models:weekly-limit-remaining", percent: 20, resetAt: "2026-10-08T00:00:00.000Z" }),
  win({ id: "claude-and-gpt-models:weekly-limit-remaining", percent: 10, resetAt: "2026-10-08T00:00:00.000Z" }),
  win({ id: "gemini-models:five-hour-limit-remaining", percent: 0, resetAt: "2026-10-04T05:00:00.000Z" }),
  win({ id: "claude-and-gpt-models:five-hour-limit-remaining", percent: 0, resetAt: "2026-10-04T05:00:00.000Z" }),
]) };

test("agy shows expected on every weekly window", () => {
  const lines = renderResults([agy]);
  const marked = lines.filter((line) => line.includes("expected="));

  assert.equal(marked.length, 2);
  assert.ok(marked.some((line) => line.includes("- g-w ")));
  assert.ok(marked.some((line) => line.includes("- c-w ")));
  assert.ok(marked.every((line) => line.includes("expected=42.86")));
  assert.ok(!lines.some((line) => line.includes("- g-5h ") && line.includes("expected=")));
  assert.ok(!lines.some((line) => line.includes("- c-5h ") && line.includes("expected=")));
});

test("agy pretty appends exp to both weekly windows", () => {
  const text = renderPretty([agy]).join("\n");

  assert.equal(text.split("(exp 42.86%)").length - 1, 2);
});

test("other providers still mark only the single selected window", () => {
  const claude: UsageResult = { provider: "claude", snapshot: createSnapshot("claude", observedAt, [
    win({ id: "weekly:7d", percent: 12, resetAt: "2026-10-08T00:00:00.000Z" }),
    win({ id: "weekly:sonnet:7d", percent: 20, resetAt: "2026-10-08T00:00:00.000Z" }),
  ]) };
  const marked = renderResults([claude]).filter((line) => line.includes("expected="));

  assert.equal(marked.length, 1);
  assert.ok(marked[0]!.includes("- w "));
});
