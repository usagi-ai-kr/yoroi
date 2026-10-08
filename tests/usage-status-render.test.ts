import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot, type UsageWindow } from "../src/domain/usage.js";
import { formatStatus, renderPretty } from "../src/ui/cli/render.js";
import { renderResults } from "../src/ui/cli/render.js";

const observedAt = "2026-10-07T05:30:00.000Z";
const resetAt = "2026-10-08T00:00:00.000Z";
const win = (window: Partial<UsageWindow> & { id: string }): UsageWindow =>
  ({ unit: "percent", ...window });
const plain = (w: UsageWindow): UsageResult =>
  ({ provider: "opencode-go", snapshot: createSnapshot("opencode-go", observedAt, [w]) });
const statusOf = (w: UsageWindow): string | undefined =>
  renderResults([plain(w)])[1]?.match(/usage_status=(\S+)/)?.[1];

test("plain appends usage_status at the end of window metrics", () => {
  const weekly = win({ id: "weekly", percent: 89, resetAt });

  assert.equal(statusOf(weekly), "optimal");
  const line = renderResults([plain(weekly)])[1]!;

  assert.ok(line.endsWith("usage_status=optimal"), line);
});

test("status follows the actual-versus-expected comparison", () => {
  assert.equal(statusOf(win({ id: "weekly", percent: 3, resetAt })), "under");
  assert.equal(statusOf(win({ id: "weekly", percent: 95, resetAt })), "over");
  assert.equal(statusOf(win({ id: "weekly", percent: 86, resetAt })), "optimal");
  assert.equal(statusOf(win({ id: "weekly", used: 95, limit: 100, resetAt })), "over");
});

test("missing expected or actual ratio stays n/a", () => {
  assert.equal(statusOf(win({ id: "rolling", percent: 4 })), "n/a");
  assert.equal(statusOf(win({ id: "weekly", percent: 3 })), "n/a");
  assert.equal(statusOf(win({ id: "weekly", remaining: 4, resetAt })), "n/a");
});

test("pretty Status column shows ok plus the status inside 22 columns", () => {
  const result = plain(win({ id: "weekly", percent: 95, resetAt }));
  const lines = renderPretty([result]);
  const text = stripVTControlCharacters(lines.join("\n"));

  assert.match(text, /│ ok over\s*│/);
  const widths = lines.map((line) => stripVTControlCharacters(line).length);
  assert.equal(new Set(widths).size, 1);
  assert.equal(stripVTControlCharacters(lines[1]!).split("│")[5]!.trim().length <= 22, true);
});

test("formatStatus colors each status and keeps the ok prefix", () => {
  for (const status of ["under", "optimal", "over", "n/a"] as const) {
    const plainText = stripVTControlCharacters(formatStatus(false, status));
    const colored = stripVTControlCharacters(formatStatus(true, status));
    assert.equal(plainText, `ok ${status}`);
    assert.equal(colored, `ok ${status}`, "색상 유무와 무관한 텍스트");
  }
});