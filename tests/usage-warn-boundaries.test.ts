import assert from "node:assert/strict";
import test from "node:test";
import { type ProviderId, type UsageWindow } from "../src/domain/usage.js";
import { usageStatus } from "../src/ui/cli/pace.js";

const observedAt = "2026-10-07T05:30:00.000Z";
const resetAt = "2026-10-08T00:00:00.000Z"; // weekly exp ~ 89.28%
const win = (id: string, partial: Partial<UsageWindow>): UsageWindow =>
  ({ id, unit: "percent", ...partial });

test("7개 경계값 x exp 유무 x 4개 공급자 usageStatus 행렬 검증", () => {
  const providers: readonly ProviderId[] = ["opencode-go", "agy", "ollama-pro", "xai"];
  const boundaries = [
    { percent: 89.9, expStatus: "optimal", noExpStatus: "n/a" }, // |89.9 - 89.28| = 0.62 <= 3 -> optimal
    { percent: 90, expStatus: "warn", noExpStatus: "warn" },
    { percent: 97.9, expStatus: "warn", noExpStatus: "warn" },
    { percent: 98, expStatus: "limit", noExpStatus: "limit" },
    { percent: 99.9, expStatus: "limit", noExpStatus: "limit" },
    { percent: 100, expStatus: "limit", noExpStatus: "limit" },
    { percent: undefined, expStatus: "n/a", noExpStatus: "n/a" },
  ] as const;

  for (const provider of providers) {
    const id = provider === "ollama-pro" ? "monthly" : "weekly";
    for (const b of boundaries) {
      const p = b.percent !== undefined ? { percent: b.percent } : {};
      const wWithExp = win(id, { ...p, resetAt });
      const wNoExp = win(id, p);
      const expectedWith = b.percent === 89.9 && provider === "ollama-pro" ? "under" : b.expStatus;
      assert.equal(usageStatus(provider, wWithExp, [wWithExp], observedAt), expectedWith,
        `${provider} withExp percent=${b.percent}`);
      assert.equal(usageStatus(provider, wNoExp, [wNoExp], observedAt), b.noExpStatus,
        `${provider} noExp percent=${b.percent}`);
    }
  }
});

test("raw 89.991 vs 표시 90 및 used/limit 계산 경계 검증", () => {
  // 원본 89.991은 90 미만이므로 exp(89.28) 기준 optimal, warn이 아님
  const rawBelow = win("weekly", { percent: 89.991, resetAt });
  assert.equal(usageStatus("opencode-go", rawBelow, [rawBelow], observedAt), "optimal");

  // exp 없는 경우 raw 89.991은 n/a
  const rawBelowNoExp = win("weekly", { percent: 89.991 });
  assert.equal(usageStatus("opencode-go", rawBelowNoExp, [rawBelowNoExp], observedAt), "n/a");

  // used/limit 경계
  const u899 = win("weekly", { used: 8.99, limit: 10, resetAt }); // 89.9%
  assert.equal(usageStatus("opencode-go", u899, [u899], observedAt), "optimal");
  const u90 = win("weekly", { used: 9, limit: 10 }); // 90% -> warn
  assert.equal(usageStatus("opencode-go", u90, [u90], observedAt), "warn");
  const u979 = win("weekly", { used: 9.79, limit: 10 }); // 97.9% -> warn
  assert.equal(usageStatus("opencode-go", u979, [u979], observedAt), "warn");
  const u98 = win("weekly", { used: 9.8, limit: 10 }); // 98% -> limit
  assert.equal(usageStatus("opencode-go", u98, [u98], observedAt), "limit");
});

test("다중 window 독립 상태 집계 회귀 검증", () => {
  const w1 = win("weekly", { percent: 91, resetAt }); // warn
  const w2 = win("five-hour", { percent: 50 }); // n/a
  const w3 = win("monthly", { percent: 99 }); // limit
  const windows = [w1, w2, w3];
  assert.equal(usageStatus("opencode-go", w1, windows, observedAt), "warn");
  assert.equal(usageStatus("opencode-go", w2, windows, observedAt), "n/a");
  assert.equal(usageStatus("opencode-go", w3, windows, observedAt), "limit");
});

test("remaining 전용 창은 exp 유무와 무관하게 n/a 회귀 검증", () => {
  const remWithExp = win("weekly", { remaining: 5, resetAt });
  assert.equal(usageStatus("opencode-go", remWithExp, [remWithExp], observedAt), "n/a");
  const remNoExp = win("weekly", { remaining: 5 });
  assert.equal(usageStatus("opencode-go", remNoExp, [remNoExp], observedAt), "n/a");
});
