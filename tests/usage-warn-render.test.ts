import assert from "node:assert/strict";
import test from "node:test";
import { stripVTControlCharacters } from "node:util";
import pc from "picocolors";
import { createSnapshot, type UsageWindow } from "../src/domain/usage.js";
import { formatStatus, isShownStatus } from "../src/ui/cli/render-pretty-filter.js";
import { renderPretty, renderResults } from "../src/ui/cli/render.js";
import { type UsageResult } from "../src/app/usage-source.js";

const observedAt = "2026-10-07T05:30:00.000Z";
const resetAt = "2026-10-08T00:00:00.000Z";
const win = (id: string, percent: number): UsageWindow => ({ id, unit: "percent", percent, resetAt });
const res = (provider: "opencode-go" | "agy" | "ollama-pro" | "xai", w: UsageWindow): UsageResult =>
  ({ provider, snapshot: createSnapshot(provider, observedAt, [w]) });

test("warn status formatStatus uses pc.yellowBright (ANSI 93)", () => {
  assert.equal(stripVTControlCharacters(formatStatus(false, "warn")), "ok warn");
  assert.equal(stripVTControlCharacters(formatStatus(true, "warn")), "ok warn");
  const c = pc.createColors(true);
  assert.equal(c.yellowBright("warn"), "\u001b[93mwarn\u001b[39m");
  assert.notEqual(c.yellowBright("warn"), c.yellow("warn"), "warn은 over의 yellow(33)와 다른 bright yellow(93)");
});

test("isShownStatus includes warn by default and in full mode", () => {
  assert.equal(isShownStatus("warn", false), true, "warn은 기본 SHOWN_STATUSES에 포함");
  assert.equal(isShownStatus("warn", true), true, "full 모드에서도 true");
});

test("plain rendering outputs usage_status=warn in key=value format", () => {
  const line = renderResults([res("opencode-go", win("weekly", 92))])[1]!;
  assert.match(line, /usage_status=warn/);
  assert.ok(line.startsWith("  - w [percent] usage_status=warn used=unknown"));
});

test("pretty rendering displays ok warn with preserved column widths", () => {
  const lines = renderPretty([res("opencode-go", win("weekly", 94))]);
  const text = stripVTControlCharacters(lines.join("\n"));
  assert.match(text, /│\s*opencode-go\s*│\s*ok warn\s*│\s*w\s*│/);
  const widths = lines.map((l) => stripVTControlCharacters(l).length);
  assert.equal(new Set(widths).size, 1, "모든 라인 폭 일치");
});

test("4개 공급자별 warn 렌더링 검증", () => {
  const results = [
    res("opencode-go", win("weekly", 93)),
    res("agy", win("gemini-models:weekly-credits", 90)),
    res("ollama-pro", win("monthly", 97)),
    res("xai", win("weekly", 91)),
  ];
  const prettyText = stripVTControlCharacters(renderPretty(results).join("\n"));
  assert.match(prettyText, /│\s*opencode-go\s*│\s*ok warn\s*│/);
  assert.match(prettyText, /│\s*agy\s*│\s*ok warn\s*│/);
  assert.match(prettyText, /│\s*ollama-pro\s*│\s*ok warn\s*│/);
  assert.match(prettyText, /│\s*xai\s*│\s*ok warn\s*│/);

  const plainText = renderResults(results).join("\n");
  assert.equal((plainText.match(/usage_status=warn/g) ?? []).length, 4);
});

test("JSON 스냅샷 직렬화는 status 필드 없이 raw contract를 보존한다", () => {
  const result = res("opencode-go", win("weekly", 94));
  const parsed = JSON.parse(JSON.stringify(result)) as typeof result;
  assert.ok("snapshot" in parsed);
  assert.equal(parsed.snapshot.windows[0]?.percent, 94);
  const winObj = parsed.snapshot.windows[0] as unknown as Record<string, unknown>;
  assert.equal(winObj["usage_status"], undefined);
  assert.equal(winObj["status"], undefined);
});
