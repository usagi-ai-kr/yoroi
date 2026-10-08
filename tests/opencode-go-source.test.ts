import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { NodeHttpClient } from "../src/infra/http-client.js";
import { OPENCODE_GO_USAGE_URL, OpenCodeGoSource } from "../src/infra/opencode-go-source.js";

const observedAt = "2026-10-07T00:00:00Z";
const errorFixture = await readFile(new URL("./fixtures/opencode-go-error.json", import.meta.url), "utf8");
const okBody = JSON.stringify({ usage: {
  rolling: { status: "ok", percent: 4, resetsAt: "2026-10-07T16:27:38.287Z" },
  weekly: { status: "ok", percent: 3, resetsAt: "2026-10-14T00:00:00.287Z" },
  monthly: { status: "ok", percent: 1, resetsAt: "2026-11-07T06:06:01.287Z" },
} });

const source = (fetcher: typeof fetch, apiKey = "test-key", timeoutMs = 1000) =>
  new OpenCodeGoSource(new NodeHttpClient(fetcher), apiKey, timeoutMs, () => observedAt);

function failure(code: string, ...forbidden: string[]) {
  return (error: unknown): boolean => error instanceof Error && "code" in error &&
    error.code === code && forbidden.every((text) => !error.message.includes(text));
}

test("GETs the official usage route with bearer key and maps the payload", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const snapshot = await source(async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return new Response(okBody, { status: 200 });
  }).read();

  assert.equal(seenUrl, OPENCODE_GO_USAGE_URL);
  assert.equal(seenUrl, "https://opencode.ai/zen/go/v1/usage");
  assert.equal(seenInit?.method, "GET");
  assert.match(seenUrl, /\/usage$/);
  assert.ok(!seenUrl.includes("chat/completions"));
  const headers = seenInit?.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer test-key");
  assert.deepEqual(snapshot.windows.map((window) => [window.id, window.percent]),
    [["rolling", 4], ["weekly", 3], ["monthly", 1]]);
});

test("401 and 403 are authentication, 429 and other statuses are unavailable", async () => {
  const cases: [number, string][] = [[401, "authentication"], [403, "authentication"],
    [429, "unavailable"], [500, "unavailable"], [404, "unavailable"]];
  for (const [status, code] of cases) {
    await assert.rejects(source(async () => new Response(errorFixture, { status })).read(),
      failure(code, "redacted"), String(status));
  }
});

test("blank API key fails as authentication before any HTTP request", async () => {
  let called = false;
  const fetcher: typeof fetch = async () => { called = true; return new Response(okBody); };

  await assert.rejects(source(fetcher, "   ").read(), failure("authentication"));
  assert.equal(called, false);
});

test("timeout and network failures are normalized without leaking the key", async () => {
  const hanging: typeof fetch = async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("test-key secret")), { once: true });
  });
  await assert.rejects(source(hanging, "test-key", 5).read(), failure("timeout", "test-key", "secret"));

  const broken: typeof fetch = async () => { throw new Error("test-key secret"); };
  await assert.rejects(source(broken).read(), failure("network", "test-key", "secret"));
});

test("malformed 200 bodies are parse errors without leaking the key", async () => {
  await assert.rejects(source(async () => new Response("secret-key-body", { status: 200 })).read(),
    failure("parse", "secret-key-body", "test-key"));
});
