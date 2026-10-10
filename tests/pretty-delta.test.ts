import assert from "node:assert/strict";
import test from "node:test";
import { createSnapshot } from "../src/domain/usage.js";
import { renderPretty } from "../src/ui/cli/render.js";
import { formatCacheHit, formatDelta } from "../src/ui/cli/delta-format.js";
import type { MeteredUsageResult } from "../src/app/usage-result-meta.js";
import type { UsageDelta } from "../src/domain/usage-delta-types.js";

const observedAt = "2026-10-07T05:30:00.000Z";
const snapshot = createSnapshot("codex", observedAt, [
  { id: "weekly", unit: "tokens", used: 1200, limit: 5000, percent: 24, resetAt: "2026-10-14T00:00:00Z" },
]);
const NBSP = "\u00A0";
const base = { status: "delta" as const, observedAt,
  previousObservedAt: "2026-10-07T03:30:00.000Z", elapsedMs: 7_200_000 };

test("delta picks percent first, else the window unit with compact numbers", () => {
  assert.equal(formatDelta({ ...base, values: { used: 60, percent: 4.2 } }, "tokens"), `Δ${NBSP}+4.2%p / 2h`);
  assert.equal(formatDelta({ ...base, values: { used: 1_234_567 } }, "tokens"), `Δ${NBSP}+1.24M tokens / 2h`);
  assert.equal(formatDelta({ ...base, values: { percent: -0.35 } }, "tokens"), `Δ${NBSP}-0.35%p / 2h`);
});

test("delta renders reset, omits no-previous, and shows other n/a reasons", () => {
  assert.equal(formatDelta({ status: "reset", reason: "reset-at-advanced" }, "tokens"), `Δ${NBSP}reset`);
  assert.equal(formatDelta({ status: "n/a", reason: "no-previous" }, "tokens"), undefined);
  assert.equal(formatDelta({ status: "n/a", reason: "reset-anomaly" }, "tokens"), `Δ${NBSP}n/a`);
});

test("cache hit shows <1s under one second and seconds otherwise", () => {
  assert.equal(formatCacheHit("codex", 400), "codex hit <1s ago");
  assert.equal(formatCacheHit("codex", 23_000), "codex hit 23s ago");
});

test("pretty appends the delta suffix and a single cache footer line for hits", () => {
  const delta: UsageDelta = { ...base, values: { percent: 4.2 } };
  const hit: MeteredUsageResult = { provider: "codex", snapshot,
    meta: { deltas: { weekly: delta }, cache: { hit: true, ageMs: 23_000 } } };
  const miss: MeteredUsageResult = { provider: "claude",
    snapshot: createSnapshot("claude", observedAt, []), meta: { cache: { hit: false, ageMs: 0 } } };
  const out = renderPretty([hit, miss]).join("\n");
  assert.ok(out.includes("+4.2%p / 2h"));
  assert.ok(out.includes("cache: codex hit 23s ago"));
  assert.doesNotMatch(out, /claude hit/);
});

test("pretty omits no-previous deltas and wraps the delta on its own line", () => {
  const omitted: MeteredUsageResult = { provider: "codex", snapshot,
    meta: { deltas: { weekly: { status: "n/a", reason: "no-previous" } } } };
  assert.ok(!renderPretty([omitted]).join("\n").includes("Δ"));
  const shown: MeteredUsageResult = { provider: "codex", snapshot,
    meta: { deltas: { weekly: { ...base, values: { percent: 4.2 } } } } };
  assert.match(renderPretty([shown]).join("\n"), /\n.*\(Δ\u00A0/);
});

test("pretty without meta is unchanged (no delta, no cache footer)", () => {
  const out = renderPretty([{ provider: "codex", snapshot }]).join("\n");
  assert.ok(!out.includes("Δ"));
  assert.ok(!out.includes("cache:"));
  assert.match(out, /Provider/);
});
