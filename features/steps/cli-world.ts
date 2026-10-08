import { SourceError, type SourceErrorCode, type UsageSource } from "../../src/app/usage-source.js";
import type { Scheduler } from "../../src/app/watch-usage.js";
import { createSnapshot, providers, type ProviderId } from "../../src/domain/usage.js";
import { createCli } from "../../src/ui/cli/bootstrap.js";

const observedAt = "2026-10-07T00:00:00Z";

export const world = {
  sources: [] as UsageSource[],
  stdout: [] as string[],
  stderr: [] as string[],
  exitCode: 0,
  sleeps: [] as number[],
  stopAfter: null as number | null,
  unsubscribed: false,
  handler: undefined as (() => void) | undefined,
};

export function resetWorld(): void {
  world.sources = [];
  world.stdout = [];
  world.stderr = [];
  world.exitCode = 0;
  world.sleeps = [];
  world.stopAfter = null;
  world.unsubscribed = false;
  world.handler = undefined;
}

export const allProviders = providers;

export function okSource(provider: ProviderId): UsageSource {
  return { provider, read: async () => createSnapshot(provider, observedAt, []) };
}

export function failingSource(provider: ProviderId, code: SourceErrorCode = "timeout"): UsageSource {
  return { provider, read: async () => { throw new SourceError(code); } };
}

export function flakySource(provider: ProviderId): UsageSource {
  let reads = 0;
  return {
    provider,
    read: async () => {
      reads += 1;
      if (reads === 2) throw new SourceError("timeout");
      return createSnapshot(provider, observedAt, []);
    },
  };
}

export function windowSource(provider: ProviderId, id: string, used: number, limit: number): UsageSource {
  return {
    provider,
    read: async () => createSnapshot(provider, observedAt, [{ id, unit: "requests", used, limit }]),
  };
}

export function percentSource(provider: ProviderId, id: string, percent: number): UsageSource {
  return {
    provider,
    read: async () => createSnapshot(provider, observedAt, [{ id, unit: "requests", percent }]),
  };
}

export async function runCli(argv: string[]): Promise<void> {
  const scheduler: Scheduler = {
    sleep: async (milliseconds) => {
      world.sleeps.push(milliseconds);
      if (world.stopAfter !== null && world.sleeps.length >= world.stopAfter) world.handler?.();
    },
  };
  const cli = createCli({
    env: { stdout: (text) => world.stdout.push(text), stderr: (text) => world.stderr.push(text) },
    sources: world.sources,
    scheduler,
    subscribeSignals: (handler) => {
      world.handler = handler;
      return () => { world.unsubscribed = true; };
    },
  });
  world.exitCode = await cli.run(argv);
}
