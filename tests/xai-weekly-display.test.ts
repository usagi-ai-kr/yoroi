import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import { createSnapshot } from "../src/domain/usage.js";
import { renderPretty } from "../src/ui/cli/render.js";

const prettyInput = () => [
  { provider: "xai" as const, snapshot: createSnapshot("xai", "2026-10-15T00:00:00.000Z", [
    { id: "weekly", unit: "percent", resetAt: "2026-10-22T00:00:00.000Z" },
  ]) },
  { provider: "opencode-go" as const, snapshot: createSnapshot("opencode-go", "2026-10-15T00:00:00.000Z", [
    { id: "rolling", unit: "percent" },
  ]) },
];

test("pretty default shows only xAI weekly n/a while full shows all n/a rows", () => {
  const clean = (full?: boolean) => stripVTControlCharacters(renderPretty(prettyInput(), undefined, { full }).join("\n"));
  const normal = clean();
  assert.match(normal, /│ xai\s+│ ok n\/a\s+│ w\s+│/);
  assert.match(normal, /26-10-22 09:00/);
  assert.doesNotMatch(normal, /│ opencode-go │ ok n\/a/);
  const full = clean(true);
  assert.match(full, /│ xai\s+│ ok n\/a\s+│ w\s+│/);
  assert.match(full, /│ opencode-go │ ok n\/a/);
});

test("hourly keeps xAI weekly n/a rows with known or unknown percent", () => {
  const dir = mkdtempSync(join(tmpdir(), "yoroi-xai-weekly-"));
  const input = join(dir, "usage.txt");
  const cli = join(dir, "fake-cli.sh");
  try {
    writeFileSync(cli, `#!/bin/sh\ncat '${input}'\n`, { mode: 0o700 });
    for (const [percent, shown] of [["42.5", "42.5%"], ["unknown", "?"]]) {
      writeFileSync(input, [
        "xai: ok observed=2026-10-15T00:00:00.000Z windows=1",
        `  - w [percent] usage_status=n/a used=unknown remaining=unknown limit=unknown percent=${percent} reset=unknown reset_in=7d`,
        "ollama-pro: ok observed=2026-10-15T00:00:00.000Z windows=1",
        "  - weekly [percent] usage_status=n/a used=unknown remaining=unknown limit=unknown percent=unknown reset=unknown reset_in=unknown",
      ].join("\n"));
      const output = execFileSync("bash", ["scripts/usage-hourly-report.sh"], {
        cwd: process.cwd(), encoding: "utf8",
        env: { ...process.env, YOROI_REPO: process.cwd(), YOROI_CLI: cli,
          YOROI_SKIP_UPDATE: "1", YOROI_CODE_FENCE: "0" },
      });
      assert.ok(output.split("\n").some((line) => line.includes(`xai | w | ${shown} | 7d`)), output);
      assert.doesNotMatch(output, /xai\s+\|\s+weekly/);
      assert.doesNotMatch(output, /ollama\s+\|\s+weekly/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
