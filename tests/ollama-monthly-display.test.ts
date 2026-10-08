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

test("ollama-pro plain shows only the monthly window and counts displayed windows", () => {
  const lines = renderResults([legacy]);

  assert.equal(lines[0], `ollama-pro: ok observed=${observedAt} windows=1`);
  assert.equal(lines.length, 2);
  assert.ok(lines[1]!.startsWith("  - monthly [percent] "));
  assert.ok(!lines.some((line) => line.includes("- session")));
  assert.ok(!lines.some((line) => line.includes("- weekly")));
  assert.ok(!lines.some((line) => line.includes("activity:last-4-weeks")));
  assert.equal(legacy.snapshot.windows.length, 4);
});

test("ollama-pro pretty renders only the monthly row while keeping the table intact", () => {
  const lines = renderPretty([legacy]);
  const text = lines.join("\n");

  assert.ok(text.includes("monthly"));
  assert.ok(!text.includes("session"));
  assert.ok(!text.includes("weekly"));
  assert.ok(!text.includes("activity:last-4-weeks"));
  assert.ok(text.includes("(exp"));
  const widths = lines.map((line) => stripVTControlCharacters(line).length);
  assert.equal(new Set(widths).size, 1);
});

test("ollama-pro without a monthly window keeps every window to avoid data loss", () => {
  const result: UsageResult = { provider: "ollama-pro", snapshot: createSnapshot("ollama-pro", observedAt, [
    { id: "activity:7d:request_count", unit: "requests", used: 4 },
    { id: "credits:included", unit: "USD", used: 6, remaining: 4, limit: 10 },
  ]) };
  const lines = renderResults([result]);

  assert.equal(lines[0], `ollama-pro: ok observed=${observedAt} windows=2`);
  assert.ok(lines.some((line) => line.includes("activity:7d:request_count")));
  assert.ok(lines.some((line) => line.includes("credits:included")));
});

test("other providers keep shorter windows visible", () => {
  const result: UsageResult = { provider: "opencode-go", snapshot: createSnapshot("opencode-go", observedAt, [
    { id: "rolling", unit: "percent", percent: 4, resetAt: "2026-10-04T05:00:00.000Z" },
    { id: "weekly", unit: "percent", percent: 3, resetAt: "2026-10-08T00:00:00.000Z" },
    { id: "monthly", unit: "percent", percent: 10, resetAt: "2026-11-07T00:00:00.000Z" },
  ]) };
  const lines = renderResults([result]);

  assert.equal(lines[0], `opencode-go: ok observed=${observedAt} windows=3`);
  assert.ok(lines.some((line) => line.includes("- rolling")));
  assert.ok(lines.some((line) => line.includes("- weekly")));
});
