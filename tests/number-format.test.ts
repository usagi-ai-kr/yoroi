import assert from "node:assert/strict";
import test from "node:test";
import { formatNumber } from "../src/ui/cli/format.js";
import { formatUsage, renderResult } from "../src/ui/cli/render.js";
import { createSnapshot } from "../src/domain/usage.js";

test("formatNumber rounds up to two decimal places", () => {
  assert.equal(formatNumber(12.341), "12.35");
  assert.equal(formatNumber(12.3), "12.3");
  assert.equal(formatNumber(1.1), "1.1");
  assert.equal(formatNumber(0.29), "0.29");
  assert.equal(formatNumber(99.991), "100");
  assert.equal(formatNumber(30), "30");
  assert.equal(formatNumber(-1.234), "-1.23");
});

test("pretty and plain renderers apply two-decimal ceiling", () => {
  assert.equal(formatUsage({ id: "w", unit: "tokens", percent: 33.3333, used: 1.005, limit: 3 }),
    "33.34% (1.01/3 tokens)");
  const lines = renderResult({ provider: "ollama-pro", snapshot: createSnapshot("ollama-pro", "2026-10-07T05:30:00.000Z", [
    { id: "weekly", unit: "percent", percent: 12.3401 },
  ]) });
  assert.match(lines[1] ?? "", /percent=12\.35 /);
});
