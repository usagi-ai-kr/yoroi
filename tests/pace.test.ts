import assert from "node:assert/strict";
import test from "node:test";
import type { UsageWindow } from "../src/domain/usage.js";
import { usageStatus } from "../src/ui/cli/pace.js";

const resetAt = "2026-10-08T00:00:00.000Z";
const observedAt = "2026-10-04T12:00:00.000Z"; // weekly expected = 50
const win = (id: string, extra: Partial<UsageWindow> = {}): UsageWindow =>
  ({ id, unit: "percent", resetAt, ...extra });
const bare = (id: string, extra: Partial<UsageWindow> = {}): UsageWindow =>
  ({ id, unit: "percent", ...extra });

test("boundary ±3%p is optimal and beyond is under/over", () => {
  const cases: [number, string][] = [[53, "optimal"], [47, "optimal"], [53.01, "over"], [46.99, "under"]];
  for (const [percent, expected] of cases) {
    const window = win("weekly", { percent });
    assert.equal(usageStatus("opencode-go", window, [window], observedAt), expected, `percent=${percent}`);
  }
});

test("prefers percent over used/limit", () => {
  const window = win("weekly", { percent: 53, used: 1, limit: 10 });
  assert.equal(usageStatus("opencode-go", window, [window], observedAt), "optimal");
});

test("computes actual from used/limit when percent is absent", () => {
  const half = win("weekly", { used: 3, limit: 6 });
  assert.equal(usageStatus("opencode-go", half, [half], observedAt), "optimal");
  const under = win("weekly", { used: 1, limit: 10 });
  assert.equal(usageStatus("opencode-go", under, [under], observedAt), "under");
  const over = win("weekly", { used: 8, limit: 10 });
  assert.equal(usageStatus("opencode-go", over, [over], observedAt), "over");
  const warn = win("weekly", { used: 9, limit: 10 });
  assert.equal(usageStatus("opencode-go", warn, [warn], observedAt), "warn");
  const zeroLimit = win("weekly", { used: 5, limit: 0 });
  assert.equal(usageStatus("opencode-go", zeroLimit, [zeroLimit], observedAt), "n/a");
  const neither = win("weekly");
  assert.equal(usageStatus("opencode-go", neither, [neither], observedAt), "n/a");
});

test("returns n/a when no expected value applies", () => {
  const noReset = bare("weekly", { percent: 50 });
  assert.equal(usageStatus("opencode-go", noReset, [noReset], observedAt), "n/a");
  const first = win("weekly:7d", { percent: 50 });
  const second = win("weekly:sonnet:7d", { percent: 50 });
  assert.equal(usageStatus("claude", second, [first, second], observedAt), "n/a");
});

test("agy applies expected to every weekly window", () => {
  const gemini = win("gemini-models:weekly-limit-remaining", { percent: 50 });
  const claudeGpt = win("claude-and-gpt-models:weekly-limit-remaining", { percent: 50 });
  const fiveHour = win("gemini-models:five-hour-limit-remaining", { percent: 50 });
  const windows = [gemini, claudeGpt, fiveHour];

  assert.equal(usageStatus("agy", gemini, windows, observedAt), "optimal");
  assert.equal(usageStatus("agy", claudeGpt, windows, observedAt), "optimal");
  assert.equal(usageStatus("agy", fiveHour, windows, observedAt), "n/a");
});

test("actual 98% 이상이면 예상과 무관하게 limit", () => {
  for (const percent of [98, 99, 100, 120]) {
    const window = win("weekly", { percent });
    assert.equal(usageStatus("opencode-go", window, [window], observedAt), "limit", `percent=${percent}`);
  }
  const usedLimit = win("weekly", { used: 98, limit: 100 }); // percent 없이 used/limit로 계산
  assert.equal(usageStatus("opencode-go", usedLimit, [usedLimit], observedAt), "limit");
});

test("actual 98 미만 90 이상(97.99·97)은 warn", () => {
  const justBelow = win("weekly", { percent: 97.99 }); // expected 50 → warn
  assert.equal(usageStatus("opencode-go", justBelow, [justBelow], observedAt), "warn");
  const wasLimit = win("weekly", { percent: 97 }); // 이전(97 기준)에는 limit이던 값 → warn
  assert.equal(usageStatus("opencode-go", wasLimit, [wasLimit], observedAt), "warn");
});

test("expected를 못 구해도 actual 99면 limit", () => {
  const noReset = bare("weekly", { percent: 99 }); // resetAt 없음 → expected 없음
  assert.equal(usageStatus("opencode-go", noReset, [noReset], observedAt), "limit");
});
