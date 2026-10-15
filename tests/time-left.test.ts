import assert from "node:assert/strict";
import test from "node:test";
import type { UsageResult } from "../src/app/usage-source.js";
import { createSnapshot } from "../src/domain/usage.js";
import { formatTimeLeft } from "../src/ui/cli/format.js";
import { renderPretty } from "../src/ui/cli/render.js";

const now = "2026-10-07T05:00:00.000Z";
const at = (ms: number) => new Date(Date.parse(now) + ms).toISOString();
const MIN = 60_000;

test("formatTimeLeft shows days and hours when at least one day remains", () => {
  assert.equal(formatTimeLeft(at((6 * 1440 + 18 * 60 + 30) * MIN), now), "6d 18h");
  assert.equal(formatTimeLeft(at(1440 * MIN), now), "1d 0h");
  assert.equal(formatTimeLeft(at(1441 * MIN), now), "1d 0h");
});

test("formatTimeLeft shows hours and minutes below one day", () => {
  assert.equal(formatTimeLeft(at((3 * 60 + 5) * MIN), now), "3h 5m");
  assert.equal(formatTimeLeft(at(1439 * MIN), now), "23h 59m");
  assert.equal(formatTimeLeft(at(60 * MIN), now), "1h 0m");
});

test("formatTimeLeft shows only minutes below one hour", () => {
  assert.equal(formatTimeLeft(at(45 * MIN), now), "45m");
  assert.equal(formatTimeLeft(at(59 * MIN), now), "59m");
});

test("formatTimeLeft rounds remaining seconds up to minutes", () => {
  assert.equal(formatTimeLeft(at(30_000), now), "1m");
  assert.equal(formatTimeLeft(at(59 * MIN + 1), now), "1h 0m");
  assert.equal(formatTimeLeft(now, now), "0m");
});

test("formatTimeLeft clamps past resets to 0m", () => {
  assert.equal(formatTimeLeft(at(-5 * MIN), now), "0m");
  assert.equal(formatTimeLeft(at(-3 * 1440 * MIN), now), "0m");
});

test("formatTimeLeft accepts Date for now", () => {
  assert.equal(formatTimeLeft(at(45 * MIN), new Date(now)), "45m");
});

test("formatTimeLeft returns undefined for missing or invalid dates", () => {
  assert.equal(formatTimeLeft(undefined, now), undefined);
  assert.equal(formatTimeLeft("", now), undefined);
  assert.equal(formatTimeLeft("not-a-date", now), undefined);
  assert.equal(formatTimeLeft(at(MIN), "garbage"), undefined);
});

test("renderPretty appends time left to the Reset (KST) column", () => {
  const observedAt = "2026-10-07T05:30:00.000Z";
  const result: UsageResult = {
    provider: "codex",
    snapshot: createSnapshot("codex", observedAt, [
      { id: "weekly", unit: "requests", percent: 2, resetAt: "2026-10-14T00:00:00Z" },
      { id: "daily", unit: "requests", percent: 5 },
    ]),
  };
  const output = renderPretty([result]).join("\n");
  assert.ok(output.includes("2026-10-14 09:00 (6d 18h)"));
  assert.ok(!output.includes("- ("));
});
