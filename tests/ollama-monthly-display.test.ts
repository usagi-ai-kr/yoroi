import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot } from "../src/domain/usage.js";
import { renderPretty, renderResults } from "../src/ui/cli/render.js";

const observedAt = "2026-10-04T00:00:00.000Z";
const legacy: UsageResult = { provider: "ollama-pro", snapshot: createSnapshot("ollama-pro", observedAt, [
  { id: "session", unit: "percent", percent: 35, resetAt: "2026-10-04T05:00:00.000Z" },
  { id: "weekly", unit: "percent", percent: 32, resetAt: "2026-10-08T00:00:00.000Z" },
  { id: "monthly", unit: "percent", percent: 5, resetAt: "2026-11-07T00:00:00.000Z" },
  { id: "activity:last-4-weeks", unit: "USD", used: 1.25 },
]) };

test("ollama-pro plain shows only the monthly window labeled m and hides the rest", () => {
  const lines = renderResults([legacy]);

  assert.equal(lines[0], `ollama-pro: ok observed=${observedAt} windows=1`);
  assert.equal(lines.length, 2);
  assert.ok(lines[1]!.startsWith("  - m [percent] "));
  assert.ok(!lines.some((line) => line.includes("- session")));
  assert.ok(!lines.some((line) => line.includes("- weekly")));
  assert.ok(!lines.some((line) => line.includes("activity:last-4-weeks")));
  assert.equal(legacy.snapshot.windows.length, 4);
});

test("ollama-pro pretty renders only the monthly row while keeping the table intact", () => {
  const lines = renderPretty([legacy]);
  const text = lines.join("\n");

  assert.ok(text.includes(" m "));
  assert.ok(!text.includes("session"));
  assert.ok(!text.includes("weekly"));
  assert.ok(!text.includes("activity:last-4-weeks"));
  assert.ok(text.includes("(exp"));
  const widths = lines.map((line) => stripVTControlCharacters(line).length);
  assert.equal(new Set(widths).size, 1);
});

test("current ollama schema hides activity and purchased credits rows but keeps the snapshot", () => {
  const result: UsageResult = { provider: "ollama-pro", snapshot: createSnapshot("ollama-pro", observedAt, [
    { id: "credits:included", unit: "USD", remaining: 6, limit: 10, used: 4,
      percent: 40, resetAt: "2026-11-01T00:00:00Z" },
    { id: "credits:purchased", unit: "USD", remaining: 2 },
    { id: "activity:7d:request_count", unit: "requests", used: 4 },
    { id: "activity:7d:usage_usd", unit: "USD", used: 1.25 },
    { id: "activity:7d:input_tokens", unit: "tokens", used: 100 },
    { id: "activity:7d:cached_input_tokens", unit: "tokens", used: 20 },
    { id: "activity:7d:output_tokens", unit: "tokens", used: 30 },
  ]) };
  const lines = renderResults([result]);
  const pretty = renderPretty([result]).join("\n");

  assert.equal(lines[0], `ollama-pro: ok observed=${observedAt} windows=1`);
  assert.ok(lines.some((line) => line.startsWith("  - m [USD] ")));
  assert.ok(!lines.some((line) => line.includes("credits:purchased")));
  assert.ok(!lines.some((line) => line.includes("activity:7d")));
  assert.ok(!pretty.includes("credits:purchased"));
  assert.ok(pretty.includes(" m "));
  assert.deepEqual(result.snapshot.windows.map((window) => window.id),
    ["credits:included", "credits:purchased", "activity:7d:request_count", "activity:7d:usage_usd",
      "activity:7d:input_tokens", "activity:7d:cached_input_tokens", "activity:7d:output_tokens"]);
});

test("ollama-pro hides every non-target window when no display target exists", () => {
  const result: UsageResult = { provider: "ollama-pro", snapshot: createSnapshot("ollama-pro", observedAt, [
    { id: "session", unit: "percent", percent: 35 },
    { id: "activity:7d:request_count", unit: "requests", used: 4 },
  ]) };
  const lines = renderResults([result]);
  const pretty = renderPretty([result]).join("\n");

  assert.equal(lines[0], `ollama-pro: ok observed=${observedAt} windows=0 (2 windows hidden)`);
  assert.equal(lines.length, 1);
  assert.ok(pretty.includes("(none)"));
  assert.ok(pretty.includes("2 hidden"));
  assert.ok(!pretty.includes("session"));
  assert.ok(!pretty.includes("activity:7d"));
});

test("other providers keep shorter windows visible with short labels", () => {
  const result: UsageResult = { provider: "opencode-go", snapshot: createSnapshot("opencode-go", observedAt, [
    { id: "rolling", unit: "percent", percent: 4, resetAt: "2026-10-04T05:00:00.000Z" },
    { id: "weekly", unit: "percent", percent: 3, resetAt: "2026-10-08T00:00:00.000Z" },
    { id: "monthly", unit: "percent", percent: 10, resetAt: "2026-11-07T00:00:00.000Z" },
  ]) };
  const lines = renderResults([result]);

  assert.equal(lines[0], `opencode-go: ok observed=${observedAt} windows=3`);
  assert.ok(lines.some((line) => line.startsWith("  - 5h [percent]")));
  assert.ok(lines.some((line) => line.startsWith("  - w [percent]")));
  assert.ok(lines.some((line) => line.startsWith("  - m [percent]")));
});
