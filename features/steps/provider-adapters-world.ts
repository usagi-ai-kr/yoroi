import { readFile } from "node:fs/promises";
import type { UsageResult } from "../../src/app/usage-source.js";
import type { HttpClient } from "../../src/infra/http-client.js";
import type { ProcessOutput, ProcessRunner } from "../../src/infra/process-port.js";
import { AgySource } from "../../src/infra/agy-source.js";
import { CodexSource } from "../../src/infra/codex-source.js";
import { OllamaSource } from "../../src/infra/ollama-source.js";
import { OpenCodeGoSource } from "../../src/infra/opencode-go-source.js";
import { resetWorld, world } from "./cli-world.js";
import { createClaudeSource, resetClaudeWire } from "./claude-readonly-world.js";

const fixture = (name: string) =>
  readFile(new URL(`../../tests/fixtures/${name}`, import.meta.url), "utf8");
const codexBody = JSON.stringify(JSON.parse(await fixture("codex-rate-limits.json")));
const agyBody = await fixture("agy-usage.txt");
const opencodeBody = await fixture("opencode-go-usage.json");
const ollamaBody = JSON.stringify({ limits: { session: { usage: 0.25 },
  weekly: { usage: 0.6 }, monthly: { usage: 0.9 } }, activity: { cost: "1.23" } });
const ollamaActivityBody = JSON.stringify({ range: "7d", scope: "self", granularity: "day",
  totals: { request_count: 4, usage_usd: 1.25, input_tokens: 100,
    cached_input_tokens: 20, output_tokens: 30 } });
export { ollamaActivityBody };
const ollamaBalanceBody = JSON.stringify({ included: { balance_usd: 6, allowance_usd: 10,
  period: { from: "2026-10-01T00:00:00Z", until: "2026-11-01T00:00:00Z" } },
  purchased: { balance_usd: 2 } });

export const fakeTransport = { opencodeStatus: 200, agyExitCode: 0,
  ollamaStatus: 200, ollamaBody: ollamaBody as string };
export const adapterResults: UsageResult[] = [];

const http: HttpClient = {
  request: async (request) => {
    if (request.url.startsWith("https://ollama.com/api/usage")) {
      return { status: fakeTransport.ollamaStatus, headers: {}, body: fakeTransport.ollamaBody };
    }
    if (request.url.startsWith("https://ollama.com/api/balance")) {
      return { status: 200, headers: {}, body: ollamaBalanceBody };
    }
    if (request.url === "https://opencode.ai/zen/go/v1/usage") {
      return { status: fakeTransport.opencodeStatus, headers: {}, body: opencodeBody };
    }
    return { status: 500, headers: {}, body: "" };
  },
};

const process: ProcessRunner = {
  run: async (request): Promise<ProcessOutput> => {
    if (request.executable === "codex") return { stdout: codexBody, stderr: "", exitCode: 0 };
    if (request.executable === "agy") {
      return { stdout: agyBody, stderr: "", exitCode: fakeTransport.agyExitCode };
    }
    return { stdout: "", stderr: "", exitCode: 1 };
  },
};

export function installRealAdapters(): void {
  resetWorld();
  fakeTransport.opencodeStatus = 200;
  fakeTransport.agyExitCode = 0;
  fakeTransport.ollamaStatus = 200;
  fakeTransport.ollamaBody = ollamaBody;
  adapterResults.length = 0;
  resetClaudeWire();
  world.sources = [
    new OllamaSource(http, async () => "Signature bdd"),
    new OpenCodeGoSource(http, "bdd-opencode-go-key"),
    new CodexSource(process),
    new AgySource(process),
    createClaudeSource(),
  ];
}
