import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { providers, type ProviderId } from "../../src/domain/usage.js";
import type { SourceFactories } from "../../src/composition/sources.js";
import type { UsageSource } from "../../src/app/usage-source.js";
import type { HttpClient } from "../../src/infra/http-client.js";
import type { ProcessRunner } from "../../src/infra/process-port.js";
import { AgySource } from "../../src/infra/agy-source.js";
import { ClaudeSource } from "../../src/infra/claude-source.js";
import { CodexSource } from "../../src/infra/codex-source.js";
import { OllamaSource } from "../../src/infra/ollama-source.js";
import { fileOllamaAuthorization } from "../../src/infra/ollama-key.js";
import { OpenCodeGoSource } from "../../src/infra/opencode-go-source.js";

const fixture = (name: string) =>
  readFile(new URL(`../../tests/fixtures/${name}`, import.meta.url), "utf8");
const codexBody = JSON.stringify(JSON.parse(await fixture("codex-rate-limits.json")));
const agyBody = await fixture("agy-usage.txt");
const claudeBody = await fixture("claude-usage.txt");
const opencodeBody = await fixture("opencode-go-usage.json");
const ollamaBody = JSON.stringify({ limits: { session: { usage: 0.25 } } });

const fakeHttp: HttpClient = {
  request: async (req) => {
    if (req.url.startsWith("https://ollama.com/api/usage")) return { status: 200, headers: {}, body: ollamaBody };
    if (req.url === "https://opencode.ai/zen/go/v1/usage") return { status: 200, headers: {}, body: opencodeBody };
    return { status: 404, headers: {}, body: "" };
  },
};

const fakeProcess: ProcessRunner = {
  run: async (req) => {
    if (req.executable === "codex") return { stdout: codexBody, stderr: "", exitCode: 0 };
    if (req.executable === "agy") return { stdout: agyBody, stderr: "", exitCode: 0 };
    if (req.executable === "claude") return { stdout: claudeBody, stderr: "", exitCode: 0 };
    return { stdout: "", stderr: "", exitCode: 1 };
  },
};

export interface TimelineEvent { kind: "cycle_start" | "collection_end" | "sleep_start" | "sleep_end"; time: number }

export class DefaultProvidersWorld {
  clock = 0;
  timeline: TimelineEvent[] = [];
  activeQueries = 0;
  collectionDelayMs = 0;
  stopAfter: number | null = null;
  cyclesCompleted = 0;
  configEnv: Record<string, string | undefined> = {};
  stdout: string[] = [];
  exitCode = 0;
  sleepIntervals: number[] = [];
  handler: (() => void) | undefined = undefined;

  reset(): void {
    this.clock = 0; this.timeline = []; this.activeQueries = 0; this.collectionDelayMs = 0;
    this.stopAfter = null; this.cyclesCompleted = 0; this.configEnv = {}; this.stdout = [];
    this.exitCode = 0; this.sleepIntervals = []; this.handler = undefined;
  }
}

export function createFactories(world: DefaultProvidersWorld): SourceFactories {
  const wrap = (source: UsageSource, id: ProviderId): UsageSource => ({
    provider: id,
    read: async (signal) => {
      if (world.activeQueries === 0) world.timeline.push({ kind: "cycle_start", time: world.clock });
      world.activeQueries++;
      try {
        return await source.read(signal);
      } finally {
        world.activeQueries--;
        if (world.activeQueries === 0) {
          world.clock += world.collectionDelayMs;
          world.timeline.push({ kind: "collection_end", time: world.clock });
        }
      }
    },
  });

  return {
    "opencode-go": (s) => wrap(new OpenCodeGoSource(fakeHttp, s.apiKey ?? ""), "opencode-go"),
    "ollama-pro": (s) => wrap(new OllamaSource(fakeHttp,
      s.signingKeyPath ? async () => "dummy-sig" : fileOllamaAuthorization("")), "ollama-pro"),
    codex: (s) => wrap(new CodexSource(fakeProcess, s.executable), "codex"),
    agy: (s) => wrap(new AgySource(fakeProcess, s.executable), "agy"),
    claude: (s) => wrap(new ClaudeSource(fakeProcess, s.executable), "claude"),
  };
}
