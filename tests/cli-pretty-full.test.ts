import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/ui/cli/args.js";
import { renderPretty } from "../src/ui/cli/render.js";
import { getHelpText } from "../src/ui/cli/help.js";
import { isShownStatus, setPrettyFullMode } from "../src/ui/cli/render-pretty-filter.js";
import type { UsageResult } from "../src/app/usage-source.js";

const sampleResults: readonly UsageResult[] = [
  {
    provider: "claude",
    snapshot: {
      provider: "claude", observedAt: "2026-10-15T09:00:00.000Z",
      windows: [
        { id: "weekly:7d", unit: "percent", percent: 95, used: 95, limit: 100, resetAt: "2026-10-22T09:00:00.000Z" },
        { id: "weekly:extra:7d", unit: "percent" },
        { id: "session:5h", unit: "percent", percent: 99, resetAt: "2026-10-15T14:00:00.000Z" },
      ],
    },
  },
  {
    provider: "ollama-pro",
    snapshot: {
      provider: "ollama-pro", observedAt: "2026-10-15T09:00:00.000Z",
      windows: [{ id: "monthly", unit: "percent", percent: 99, resetAt: "2026-11-01T00:00:00Z" }],
    },
  },
];

test("isShownStatus shows under, n/a, optimal and hides over, limit unless full", () => {
  for (const s of ["under", "optimal", "n/a"] as const) assert.equal(isShownStatus(s, false), true);
  for (const s of ["over", "limit"] as const) assert.equal(isShownStatus(s, false), false);
  for (const s of ["under", "optimal", "n/a", "over", "limit"] as const) assert.equal(isShownStatus(s, true), true);
});

test("parseArgs parses --full and --pretty --full correctly without global mutation", () => {
  const p1 = parseArgs(["once", "--pretty", "--full"]);
  assert.equal(p1.kind === "once" && p1.pretty && p1.full, true);
  const p2 = parseArgs(["once", "--full"]);
  assert.equal(p2.kind === "once" && p2.full && p2.pretty === undefined, true);
});

const stripAnsi = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, ""); // CI 러너는 색을 켜 단정 문자열에 ANSI 코드가 끼어든다

test("renderPretty default shows under/na/optimal, hides over/limit and displays hidden summary", () => {
  setPrettyFullMode(false);
  const text = stripAnsi(renderPretty(sampleResults).join("\n"));
  assert.ok(!text.includes("ok over") && !text.includes("ok limit"), "over and limit are hidden");
  assert.ok(text.includes("e-w") && text.includes("ok n/a"), "n/a is displayed");
  assert.ok(text.includes("숨김 1개(over/limit)"), "provider with all hidden windows displays summary row");
});

test("renderPretty with full option displays all windows including over and limit", () => {
  const text = stripAnsi(renderPretty(sampleResults, undefined, { full: true }).join("\n"));
  assert.ok(text.includes("ok over") && text.includes("ok limit"), "over and limit visible in full mode");
  assert.ok(text.includes("e-w") && text.includes("ok n/a"), "n/a visible in full mode");
});

test("setPrettyFullMode toggles full mode globally", () => {
  setPrettyFullMode(true);
  const text = stripAnsi(renderPretty(sampleResults).join("\n"));
  assert.ok(text.includes("ok over") && text.includes("ok limit"));
  setPrettyFullMode(false);
});

test("help text documents --full option and example", () => {
  const help = getHelpText("once");
  assert.ok(help.includes("--full") && help.includes("including over and limit"));
  assert.ok(help.includes("yoroi once --pretty --full"));
});
