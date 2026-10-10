import assert from "node:assert/strict";
import test from "node:test";
import { isObject, isText, isFiniteNumber, isIsoDate, isIsoTimestamp,
  unknownFields } from "../src/insights/parse-utils.js";

test("isObject/isText/isFiniteNumber accept only the documented shapes", () => {
  assert.ok(isObject({})); assert.ok(!isObject([])); assert.ok(!isObject(null)); assert.ok(!isObject("x"));
  assert.ok(isText("x")); assert.ok(!isText("  ")); assert.ok(!isText(1));
  assert.ok(isFiniteNumber(0)); assert.ok(isFiniteNumber(-1.5)); assert.ok(!isFiniteNumber(Infinity));
  assert.ok(!isFiniteNumber(NaN)); assert.ok(!isFiniteNumber("1"));
});

test("isIsoDate matches the former arena validDate (leap and impossible days)", () => {
  assert.ok(isIsoDate("2024-02-29")); assert.ok(isIsoDate("2026-01-02"));
  assert.ok(!isIsoDate("2023-02-29")); assert.ok(!isIsoDate("2026-02-30"));
  assert.ok(!isIsoDate("2026-13-01")); assert.ok(!isIsoDate("2026-04-31"));
  assert.ok(!isIsoDate("2026-1-2")); assert.ok(!isIsoDate("2026-01-02T00:00:00Z"));
});

test("isIsoTimestamp requires a full time component", () => {
  assert.ok(isIsoTimestamp("2026-01-04T12:00:00.000Z"));
  assert.ok(isIsoTimestamp("2026-01-04T12:00:00+09:00"));
  assert.ok(!isIsoTimestamp("2026-01-04")); assert.ok(!isIsoTimestamp("2026-02-30T00:00:00Z"));
  assert.ok(!isIsoTimestamp("not-a-time"));
});

test("unknownFields counts without leaking values", () => {
  assert.deepEqual(unknownFields({ a: 1, b: 2 }, ["a"], "row"), ["Ignored 1 unknown fields at row"]);
  assert.deepEqual(unknownFields({ a: 1 }, ["a", "b"], "row"), []);
});
