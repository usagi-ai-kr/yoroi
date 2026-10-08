import assert from "node:assert/strict";
import test from "node:test";
import type { UsageWindow } from "../src/domain/usage.js";
import { expectedPercent, expectedSuffix, quotaKind } from "../src/ui/cli/expected.js";
import { formatNumber } from "../src/ui/cli/format.js";

const win = (window: Partial<UsageWindow> & { id: string }): UsageWindow =>
  ({ unit: "percent", ...window });

test("credits:included is monthly and needs a validated period start", () => {
  const weekly = win({ id: "weekly", resetAt: "2026-10-08T00:00:00.000Z" });
  const credits = win({ id: "credits:included", unit: "USD",
    periodStart: "2026-10-01T00:00:00.000Z",
    resetAt: "2026-11-01T00:00:00.000Z" });

  assert.equal(quotaKind("credits:included"), "monthly");
  assert.equal(quotaKind("credits:purchased"), undefined);
  assert.equal(formatNumber(expectedPercent(credits, "2026-10-15T00:00:00.000Z")!), "45.17");
  assert.equal(expectedSuffix(weekly, [weekly, credits], "2026-10-15T00:00:00.000Z"), "");
  assert.equal(expectedSuffix(credits, [weekly, credits], "2026-10-15T00:00:00.000Z"), " (exp 45.17%)");
});

test("credits:included hides expected without a usable period start", () => {
  const observedAt = "2026-10-15T00:00:00.000Z";
  const base = { id: "credits:included", unit: "USD", resetAt: "2026-11-01T00:00:00.000Z" };

  assert.equal(expectedPercent(win(base), observedAt), undefined);
  assert.equal(expectedPercent(win({ ...base, periodStart: "not-a-date" }), observedAt), undefined);
  assert.equal(expectedPercent(win({ ...base, periodStart: "2026-11-01T00:00:00.000Z" }), observedAt), undefined);
  assert.equal(expectedPercent(win({ ...base, periodStart: "2026-12-01T00:00:00.000Z" }), observedAt), undefined);
});
