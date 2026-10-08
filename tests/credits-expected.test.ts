import assert from "node:assert/strict";
import test from "node:test";
import type { UsageWindow } from "../src/domain/usage.js";
import { expectedPercent, expectedSuffix, quotaKind } from "../src/ui/cli/expected.js";
import { formatNumber } from "../src/ui/cli/format.js";

const observedAt = "2026-10-04T00:00:00.000Z";
const win = (window: Partial<UsageWindow> & { id: string }): UsageWindow =>
  ({ unit: "percent", ...window });

test("credits:included is monthly and wins expected selection over weekly", () => {
  const weekly = win({ id: "weekly", resetAt: "2026-10-08T00:00:00.000Z" });
  const credits = win({ id: "credits:included", unit: "USD", resetAt: "2026-11-07T00:00:00.000Z" });

  assert.equal(quotaKind("credits:included"), "monthly");
  assert.equal(quotaKind("credits:purchased"), undefined);
  assert.equal(formatNumber(expectedPercent(credits, "2026-10-27T00:00:00.000Z")!), "64.52");
  assert.equal(expectedSuffix(weekly, [weekly, credits], observedAt), "");
  assert.equal(expectedSuffix(credits, [weekly, credits], observedAt), " (exp 0%)");
});
