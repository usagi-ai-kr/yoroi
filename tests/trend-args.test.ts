import assert from "node:assert/strict";
import test from "node:test";
import { parseTrend } from "../src/ui/cli/trend-args.js";
import { parseArgs } from "../src/ui/cli/args.js";
import { getHelpText } from "../src/ui/cli/help.js";

test("trend default args returns kind trend with no options", () => {
  assert.deepEqual(parseTrend([]), { kind: "trend" });
  assert.deepEqual(parseArgs(["trend"]), { kind: "trend" });
});

test("trend normal option parsing", () => {
  assert.deepEqual(parseTrend(["--provider", "claude"]), { kind: "trend", provider: "claude" });
  assert.deepEqual(parseTrend(["--window", "5h"]), { kind: "trend", windowId: "5h" });
  assert.deepEqual(parseTrend(["--since", "24h"]), { kind: "trend", since: "24h" });
  assert.deepEqual(parseTrend(["--since", "7d"]), { kind: "trend", since: "7d" });
  assert.deepEqual(parseTrend(["--since", "30d"]), { kind: "trend", since: "30d" });
  assert.deepEqual(parseTrend(["--pretty"]), { kind: "trend", pretty: true });
  assert.deepEqual(parseTrend(["--json"]), { kind: "trend", json: true });

  const combined = parseTrend([
    "--provider", "codex",
    "--window", "daily",
    "--since", "7d",
    "--pretty",
  ]);
  assert.deepEqual(combined, {
    kind: "trend",
    provider: "codex",
    windowId: "daily",
    since: "7d",
    pretty: true,
  });
});

test("trend rejects invalid --since option", () => {
  for (const invalid of ["90d", "1h", "all", "yesterday"]) {
    const res = parseTrend(["--since", invalid]);
    assert.equal(res.kind, "error");
    assert.match((res as { message: string }).message, /invalid since/);
  }
});

test("trend rejects invalid --provider option", () => {
  const res = parseTrend(["--provider", "unknown-provider"]);
  assert.equal(res.kind, "error");
  assert.match((res as { message: string }).message, /invalid provider/);
});

test("trend rejects duplicate options", () => {
  assert.equal(parseTrend(["--pretty", "--pretty"]).kind, "error");
  assert.equal(parseTrend(["--json", "--json"]).kind, "error");
  assert.equal(parseTrend(["--provider", "claude", "--provider", "codex"]).kind, "error");
  assert.equal(parseTrend(["--since", "7d", "--since", "24h"]).kind, "error");
  assert.equal(parseTrend(["--window", "1d", "--window", "2d"]).kind, "error");
});

test("trend rejects conflicting --pretty and --json", () => {
  assert.deepEqual(parseTrend(["--pretty", "--json"]), {
    kind: "error",
    message: "cannot specify both --pretty and --json",
  });
  assert.deepEqual(parseTrend(["--json", "--pretty"]), {
    kind: "error",
    message: "cannot specify both --pretty and --json",
  });
});

test("trend rejects missing option values and unknown arguments", () => {
  assert.equal(parseTrend(["--provider"]).kind, "error");
  assert.equal(parseTrend(["--window"]).kind, "error");
  assert.equal(parseTrend(["--since"]).kind, "error");
  assert.equal(parseTrend(["--provider", "--json"]).kind, "error");
  assert.equal(parseTrend(["--unknown"]).kind, "error");
  assert.equal(parseTrend(["extra"]).kind, "error");
});

test("trend help parsing and help text", () => {
  for (const argv of [["--help"], ["-h"], ["--provider", "claude", "--help"], ["-h", "--pretty"]]) {
    assert.deepEqual(parseTrend(argv), { kind: "help", subcommand: "trend" });
  }
  for (const argv of [["trend", "--help"], ["trend", "-h"]]) {
    assert.deepEqual(parseArgs(argv), { kind: "help", subcommand: "trend" });
  }
  const helpText = getHelpText("trend");
  assert.match(helpText, /usage: yoroi trend/);
  assert.match(helpText, /--since 24h\|7d\|30d/);
});
