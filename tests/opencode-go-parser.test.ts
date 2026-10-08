import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { parseOpenCodeGoUsage } from "../src/infra/opencode-go-parser.js";

const observedAt = "2026-10-07T00:00:00Z";
const fixture = await readFile(new URL("./fixtures/opencode-go-usage.json", import.meta.url), "utf8");

function parseError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "parse" &&
    !error.message.includes("secret");
}

test("parses the confirmed 200 contract into rolling/weekly/monthly windows", () => {
  const snapshot = parseOpenCodeGoUsage(fixture, observedAt);

  assert.equal(snapshot.provider, "opencode-go");
  assert.equal(snapshot.observedAt, observedAt);
  assert.deepEqual(snapshot.windows.map((window) => [window.id, window.unit, window.percent, window.resetAt]), [
    ["rolling", "percent", 4, "2026-10-07T16:27:38.287Z"],
    ["weekly", "percent", 3, "2026-10-14T00:00:00.287Z"],
    ["monthly", "percent", 100, "2026-11-07T06:06:01.287Z"],
  ]);
});

test("missing windows fall back to the remaining windows and reset is optional", () => {
  const weeklyOnly = JSON.stringify({ usage: {
    weekly: { status: "ok", percent: 3, resetsAt: "2026-10-14T00:00:00.287Z" } } });
  assert.deepEqual(parseOpenCodeGoUsage(weeklyOnly, observedAt).windows.map((window) => window.id), ["weekly"]);

  const noReset = JSON.stringify({ usage: { rolling: { status: "ok", percent: 4 } } });
  assert.deepEqual(parseOpenCodeGoUsage(noReset, observedAt).windows, [
    { id: "rolling", unit: "percent", percent: 4 },
  ]);
});

test("invalid payloads are parse errors without echoing the body", () => {
  const bodies = [
    "secret",
    "{}",
    '{"usage":[]}',
    '{"usage":{}}',
    JSON.stringify({ usage: { rolling: { status: "weird", percent: 1 } } }),
    JSON.stringify({ usage: { rolling: { status: "ok", percent: "4" } } }),
    JSON.stringify({ usage: { rolling: { status: "ok", percent: 101 } } }),
    JSON.stringify({ usage: { rolling: { status: "ok", percent: 4, resetsAt: "not-a-date" } } }),
  ];
  for (const body of bodies) {
    assert.throws(() => parseOpenCodeGoUsage(body, observedAt), parseError, body);
  }
});
