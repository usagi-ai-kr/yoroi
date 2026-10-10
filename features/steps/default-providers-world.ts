import { readFile } from "node:fs/promises";
import type { SourceFactories } from "../../src/composition/sources.js";
import type { HttpClient } from "../../src/infra/http-client.js";
import type { ProcessRunner } from "../../src/infra/process-port.js";
import { AgySource } from "../../src/infra/agy-source.js";
import { CodexSource } from "../../src/infra/codex-source.js";
import { OllamaSource } from "../../src/infra/ollama-source.js";
import { fileOllamaAuthorization } from "../../src/infra/ollama-key.js";
import { OpenCodeGoSource } from "../../src/infra/opencode-go-source.js";
import { createClaudeSource, resetClaudeWire } from "./claude-readonly-world.js";

const fixture = (name: string) => readFile(new URL(`../../tests/fixtures/${name}`, import.meta.url), "utf8");
const codexBody = JSON.stringify(JSON.parse(await fixture("codex-rate-limits.json")));
const agyBody = await fixture("agy-usage.txt");
const opencodeBody = await fixture("opencode-go-usage.json");
const ollamaBody = JSON.stringify({ limits: { session: { usage: 0.25 } } });
const fakeHttp: HttpClient = { request: async request => {
  if (request.url.startsWith("https://ollama.com/api/usage")) return { status: 200, headers: {}, body: ollamaBody };
  if (request.url === "https://opencode.ai/zen/go/v1/usage") return { status: 200, headers: {}, body: opencodeBody };
  return { status: 404, headers: {}, body: "" };
} };
const fakeProcess: ProcessRunner = { run: async request => {
  if (request.executable === "codex") return { stdout: codexBody, stderr: "", exitCode: 0 };
  if (request.executable === "agy") return { stdout: agyBody, stderr: "", exitCode: 0 };
  return { stdout: "", stderr: "", exitCode: 1 };
} };

export class DefaultProvidersWorld {
  configEnv: Record<string, string | undefined> = {};
  stdout: string[] = [];
  exitCode = 0;
  reset(): void {
    resetClaudeWire();
    this.configEnv = {};
    this.stdout = [];
    this.exitCode = 0;
  }
}

export function createFactories(): SourceFactories {
  return {
    "opencode-go": settings => new OpenCodeGoSource(fakeHttp, settings.apiKey ?? ""),
    "ollama-pro": settings => new OllamaSource(fakeHttp,
      settings.signingKeyPath ? async () => "dummy-sig" : fileOllamaAuthorization("")),
    codex: settings => new CodexSource(fakeProcess, settings.executable),
    agy: settings => new AgySource(fakeProcess, settings.executable),
    claude: settings => createClaudeSource(settings.oauthToken ?? ""),
  };
}
