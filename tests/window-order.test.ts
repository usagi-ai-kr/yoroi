import assert from "node:assert/strict";
import test from "node:test";
import { type UsageWindow } from "../src/domain/usage.js";
import { displayWindows } from "../src/ui/cli/labels.js";
import { rankOf, sortByRank } from "../src/ui/cli/order.js";
import { renderPretty } from "../src/ui/cli/render.js";
import { renderResults } from "../src/ui/cli/render.js";
import { type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot } from "../src/domain/usage.js";

const observedAt = "2026-10-07T05:30:00.000Z";
const w = (id: string, extra: Partial<UsageWindow> = {}): UsageWindow =>
  ({ id, unit: "percent", ...extra });

test("ranks labels m, w, 5h and unlabeled internal ids", () => {
  assert.deepEqual(["m", "w", "5h", "g-w", "c-5h", "daily"]
    .map(rankOf), [0, 1, 2, 1, 2, 3]);
});

test("sorts display windows by rank and keeps collection order within a rank", () => {
  assert.deepEqual(displayWindows("agy", [
    w("gemini-models:five-hour-limit-remaining"), w("gemini-models:weekly-limit-remaining"),
    w("daily-limit-remaining"), w("claude-and-gpt-models:weekly-limit-remaining"),
  ]).map((window) => window.id), [
    "gemini-models:weekly-limit-remaining",
    "claude-and-gpt-models:weekly-limit-remaining",
    "gemini-models:five-hour-limit-remaining",
    "daily-limit-remaining",
  ]);
  assert.deepEqual(displayWindows("opencode-go", [w("rolling"), w("monthly"), w("weekly")])
    .map((window) => window.id), ["monthly", "weekly", "rolling"]);
  assert.deepEqual(sortByRank(["m", "m"], [w("credits:included"), w("monthly")])
    .map((window) => window.id), ["credits:included", "monthly"]);
});

test("plain and pretty both render the ranked order", () => {
  const result: UsageResult = {
    provider: "opencode-go",
    snapshot: createSnapshot("opencode-go", observedAt, [
      { id: "rolling", unit: "percent", percent: 1, resetAt: "2026-10-07T12:00:00Z" },
      { id: "monthly", unit: "percent", percent: 1, resetAt: "2026-11-07T00:00:00Z" },
      { id: "weekly", unit: "percent", percent: 1, resetAt: "2026-10-14T00:00:00Z" },
    ]),
  };
  const plain = renderResults([result]);

  assert.deepEqual(plain.slice(1, 4).map((line) => line.trim().split(" ")[1]), ["m", "w", "5h"]);
  const text = renderPretty([result], undefined, { full: true }).join("\n");
  assert.ok(text.indexOf(" m ") < text.indexOf(" w "));
  assert.ok(text.indexOf(" w ") < text.indexOf(" 5h "));
});