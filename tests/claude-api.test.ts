import assert from "node:assert/strict";
import test from "node:test";
import { CLAUDE_USAGE_URL, ClaudeSource } from "../src/infra/claude-source.js";
import { NodeHttpClient, type HttpClient, type HttpRequest } from "../src/infra/http-client.js";

const observedAt = "2026-10-08T00:00:00Z";
const payload = JSON.stringify({
  five_hour: { utilization: 12.5, resets_at: "2026-10-08T05:30:00+09:00" },
  seven_day: { utilization: 34, resets_at: "2026-10-10T09:00:00+09:00" },
  seven_day_sonnet: null,
  seven_day_opus: { utilization: 0, resets_at: "2026-10-08T05:30:00.123456+09:00" },
  extra_usage: { amount_dollars: 9, limit_dollars: 10 },
});
const source = (client: HttpClient, token = "test-token", timeoutMs = 1000) =>
  new ClaudeSource(client, async () => token, timeoutMs, () => observedAt);
const client = (status: number, body: string, seen?: (r: HttpRequest) => void): HttpClient =>
  ({ request: async (request) => { seen?.(request); return { status, headers: {}, body }; } });
const failure = (code: string, ...forbidden: string[]) => (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === code &&
  forbidden.every((text) => !error.message.includes(text));
const json = (value: unknown) => JSON.stringify(value);
test("GETs the OAuth usage endpoint with headers and normalizes resets to UTC", async () => {
  let request: HttpRequest | undefined;
  const snapshot = await source(client(200, payload, (seen) => { request = seen; })).read();
  assert.equal(request?.url, CLAUDE_USAGE_URL);
  assert.equal(CLAUDE_USAGE_URL, "https://api.anthropic.com/api/oauth/usage");
  assert.equal(request?.method, "GET");
  assert.equal(request?.body, undefined);
  assert.equal(request?.headers?.Authorization, "Bearer test-token");
  assert.equal(request?.headers?.["anthropic-beta"], "oauth-2025-04-20");
  assert.deepEqual(snapshot.windows.map((w) => [w.id, w.percent, w.resetAt]), [
    ["session:5h", 12.5, "2026-10-07T20:30:00.000Z"],
    ["weekly:7d", 34, "2026-10-10T00:00:00.000Z"],
    ["weekly:opus:7d", 0, "2026-10-07T20:30:00.123Z"],
  ]);
  assert.ok(snapshot.windows.every((w) => w.unit === "percent"));
  assert.ok(!snapshot.windows.some((w) => w.id.includes("extra")));
});
test("skips null buckets and rejects invalid percent, calendar dates and formats", async () => {
  const nulls = json({ five_hour: { utilization: 0 }, seven_day: { utilization: 100, resets_at: null } });
  assert.deepEqual((await source(client(200, nulls)).read()).windows
    .map((w) => [w.id, w.percent, w.resetAt]),
    [["session:5h", 0, undefined], ["weekly:7d", 100, undefined]]);
  const reset = (value: string, utilization = 12) => json({ five_hour: { utilization, resets_at: value } });
  const invalid = ["secret", json({}), json([]), json({ five_hour: { utilization: 101 } }),
    json({ five_hour: { utilization: -1 } }), json({ five_hour: { utilization: "12" } }), json({ five_hour: 12 }),
    reset("not-a-date"), reset("10"), reset("2026-02-30T00:00:00Z"), reset("2026-13-01T00:00:00Z"),
    reset("2026-10-08T24:00:00Z"), reset("2026-10-08T05:30:00"), reset("2026-10-08 05:30:00Z")];
  for (const body of invalid) {
    await assert.rejects(source(client(200, body)).read(), failure("parse", "secret"), body);
  }
});
test("maps 401/403 to authentication and 429/others to unavailable", async () => {
  const cases = [[401, "authentication"], [403, "authentication"],
    [429, "unavailable"], [500, "unavailable"], [404, "unavailable"]] as const;
  for (const [status, code] of cases) {
    await assert.rejects(source(client(status, '{"secret":"secret"}')).read(), failure(code, "secret"));
  }
});
test("blank authorization token fails before any HTTP request", async () => {
  let called = false;
  const guarded: HttpClient = { request: async () => {
    called = true; return { status: 200, headers: {}, body: payload };
  } };
  await assert.rejects(source(guarded, "   ").read(), failure("authentication"));
  assert.equal(called, false);
});
test("pre-abort and authorize-time abort skip HTTP with the signal forwarded", async () => {
  let authCalls = 0, httpCalls = 0;
  const guarded: HttpClient = { request: async () => {
    httpCalls += 1; return { status: 200, headers: {}, body: payload };
  } };
  const early = new AbortController();
  early.abort();
  const preAborted = new ClaudeSource(guarded, async () => { authCalls += 1; return "token"; });
  await assert.rejects(preAborted.read(early.signal), failure("cancelled"));
  assert.equal(authCalls, 0);
  const late = new AbortController();
  let seenSignal: AbortSignal | undefined;
  const lateSource = new ClaudeSource(guarded, async (signal) => {
    seenSignal = signal; late.abort(); return "token";
  });
  await assert.rejects(lateSource.read(late.signal), failure("cancelled"));
  assert.equal(seenSignal, late.signal);
  assert.equal(httpCalls, 0);
});
test("normalizes timeout, network and cancellation without leaking the token", async () => {
  const hanging: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("test-token secret")), { once: true });
  });
  await assert.rejects(source(new NodeHttpClient(hanging), "test-token", 5).read(),
    failure("timeout", "test-token", "secret"));
  const broken: typeof fetch = async () => { throw new Error("test-token secret"); };
  await assert.rejects(source(new NodeHttpClient(broken)).read(),
    failure("network", "test-token", "secret"));
  const controller = new AbortController();
  const pending = source(new NodeHttpClient(hanging)).read(controller.signal);
  controller.abort();
  await assert.rejects(pending, failure("cancelled"));
});
