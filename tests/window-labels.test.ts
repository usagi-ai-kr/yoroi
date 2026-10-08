import assert from "node:assert/strict";
import test from "node:test";
import { type UsageWindow } from "../src/domain/usage.js";
import { displayWindows, windowLabels } from "../src/ui/cli/labels.js";

const w = (id: string, extra: Partial<UsageWindow> = {}): UsageWindow =>
  ({ id, unit: "percent", ...extra });

test("labels the confirmed five-hour, weekly, and monthly ids per provider", () => {
  assert.deepEqual(windowLabels("opencode-go", [w("rolling"), w("weekly"), w("monthly")]),
    ["5h", "w", "m"]);
  assert.deepEqual(windowLabels("codex", [w("codex:primary:300m"), w("codex:secondary:10080m")]),
    ["5h", "w"]);
  assert.deepEqual(windowLabels("claude", [w("session:5h"), w("weekly:7d")]), ["5h", "w"]);
  assert.deepEqual(windowLabels("ollama-pro", [w("monthly"), w("credits:purchased")]),
    ["m", "credits:purchased"]);
});

test("keeps internal ids without confirmed length evidence", () => {
  assert.deepEqual(windowLabels("codex", [w("codex:primary:60m"), w("daily")]),
    ["codex:primary:60m", "daily"]);
  assert.deepEqual(windowLabels("ollama-pro", [w("activity:7d:request_count")]),
    ["activity:7d:request_count"]);
  assert.deepEqual(windowLabels("agy", [w("gemini-models:daily-limit-remaining")]),
    ["gemini-models:daily-limit-remaining"]);
});

test("adds a prefix only when the same label repeats in one provider", () => {
  assert.deepEqual(windowLabels("agy", [
    w("gemini-models:weekly-limit-remaining"), w("gemini-models:five-hour-limit-remaining"),
    w("claude-and-gpt-models:weekly-limit-remaining"), w("claude-and-gpt-models:five-hour-limit-remaining"),
  ]), ["g-w", "g-5h", "c-w", "c-5h"]);
  assert.deepEqual(windowLabels("claude", [
    w("weekly:7d"), w("weekly:sonnet:7d"), w("weekly:opus:7d"),
  ]), ["w", "s-w", "o-w"]);
  assert.deepEqual(windowLabels("claude", [w("weekly:sonnet:7d")]), ["w"]);
});

test("uses the whole first word when prefix initials collide", () => {
  assert.deepEqual(windowLabels("agy", [
    w("gemini-models:weekly-limit-remaining"), w("gpt-models:weekly-limit-remaining"),
  ]), ["gemini-w", "gpt-w"]);
});

test("falls back to internal ids when labels would still collide", () => {
  assert.deepEqual(windowLabels("ollama-pro", [w("monthly"), w("credits:included")]),
    ["monthly", "credits:included"]);
});

test("ollama-pro display keeps monthly and credits windows and hides the rest", () => {
  const current = [
    w("credits:included", { unit: "USD" }), w("credits:purchased", { unit: "USD" }),
    w("activity:7d:request_count", { unit: "requests" }), w("activity:7d:usage_usd", { unit: "USD" }),
    w("activity:7d:input_tokens", { unit: "tokens" }), w("activity:7d:cached_input_tokens", { unit: "tokens" }),
    w("activity:7d:output_tokens", { unit: "tokens" }),
  ];

  assert.deepEqual(displayWindows("ollama-pro", current).map((window) => window.id),
    ["credits:included", "credits:purchased"]);
  assert.deepEqual(displayWindows("ollama-pro", [
    w("session"), w("weekly"), w("monthly"), w("activity:last-4-weeks", { unit: "USD" }),
  ]).map((window) => window.id), ["monthly"]);
  assert.deepEqual(displayWindows("ollama-pro", [w("session"), w("activity:last-4-weeks")])
    .map((window) => window.id), ["session", "activity:last-4-weeks"]);
});
