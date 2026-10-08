import assert from "node:assert/strict";
import test from "node:test";
import { SourceError, type UsageResult } from "../src/app/usage-source.js";
import { createSnapshot } from "../src/domain/usage.js";
import { renderResults } from "../src/ui/cli/render.js";

const observedAt = "2026-10-07T05:30:00.000Z";

test("renderer prints observedAt, all window metrics and percent", () => {
  const result: UsageResult = {
    provider: "codex",
    snapshot: createSnapshot("codex", observedAt, [
      { id: "weekly", unit: "requests", used: 3, remaining: 7, limit: 10,
        percent: 30, resetAt: "2026-10-14T00:00:00Z" },
    ]),
  };

  assert.deepEqual(renderResults([result]), [
    `codex: ok observed=${observedAt} windows=1`,
    "  - weekly [requests] used=3 remaining=7 limit=10 percent=30 reset=2026-10-14T00:00:00Z reset_in=6d18h",
  ]);
});

test("renderer marks missing metrics as unknown and empty windows explicitly", () => {
  const partial: UsageResult = {
    provider: "agy",
    snapshot: createSnapshot("agy", observedAt, [{ id: "monthly", unit: "tokens", percent: 0 }]),
  };
  const empty: UsageResult = {
    provider: "claude",
    snapshot: createSnapshot("claude", observedAt, []),
  };

  assert.deepEqual(renderResults([partial, empty]), [
    `agy: ok observed=${observedAt} windows=1`,
    "  - monthly [tokens] used=unknown remaining=unknown limit=unknown percent=0 reset=unknown reset_in=unknown",
    `claude: ok observed=${observedAt} windows=0 (no usage windows reported)`,
  ]);
});

test("renderer prints normalized error lines only", () => {
  const failure: UsageResult = { provider: "claude", error: new SourceError("network") };

  assert.deepEqual(renderResults([failure]),
    ["claude: error [network] Usage query connection failed"]);
});
