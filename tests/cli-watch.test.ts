import assert from "node:assert/strict";
import test from "node:test";
import { SourceError, type UsageSource } from "../src/app/usage-source.js";
import type { Scheduler } from "../src/app/watch-usage.js";
import { createSnapshot, providers, type ProviderId } from "../src/domain/usage.js";
import { createCli } from "../src/ui/cli/bootstrap.js";

const observedAt = "2026-10-07T00:00:00Z";
const ok = (provider: ProviderId): UsageSource =>
  ({ provider, read: async () => createSnapshot(provider, observedAt, []) });

function setup(sources: readonly UsageSource[], options: { stopAfter?: number; intervalMs?: number } = {}) {
  const stdout: string[] = [];
  const sleeps: number[] = [];
  let handler: (() => void) | undefined;
  let unsubscribed = false;
  const scheduler: Scheduler = {
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      if (options.stopAfter !== undefined && sleeps.length >= options.stopAfter) handler?.();
    },
  };
  const cli = createCli({
    env: { stdout: (text) => stdout.push(text), stderr: () => {} },
    sources,
    scheduler,
    subscribeSignals: (h) => { handler = h; return () => { unsubscribed = true; }; },
    ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
  });
  return { cli, stdout, sleeps, cleanedUp: () => unsubscribed };
}

test("watch collects immediately, repeats on the default 60s interval, cleans up", async () => {
  const { cli, stdout, sleeps, cleanedUp } = setup(providers.map(ok), { stopAfter: 2 });

  assert.equal(await cli.run(["watch"]), 0);
  assert.deepEqual(sleeps, [60000, 60000]);
  assert.equal(stdout.length, providers.length * 2);
  assert.equal(cleanedUp(), true);
});

test("--interval seconds override the injected interval", async () => {
  const { cli, sleeps } = setup(providers.map(ok), { stopAfter: 1, intervalMs: 30000 });

  assert.equal(await cli.run(["watch", "--interval", "5"]), 0);
  assert.deepEqual(sleeps, [5000]);
});

test("injected intervalMs is used when --interval is absent", async () => {
  const { cli, sleeps } = setup(providers.map(ok), { stopAfter: 1, intervalMs: 15000 });

  assert.equal(await cli.run(["watch"]), 0);
  assert.deepEqual(sleeps, [15000]);
});

test("invalid interval is rejected before any collection", async () => {
  const { cli, sleeps } = setup(providers.map(ok));

  assert.equal(await cli.run(["watch", "--interval", "0"]), 2);
  assert.deepEqual(sleeps, []);
});

test("a provider failing mid-cycle does not stop later cycles", async () => {
  let reads = 0;
  const flaky: UsageSource = {
    provider: "codex",
    read: async () => {
      reads += 1;
      if (reads === 2) throw new SourceError("timeout");
      return createSnapshot("codex", observedAt, []);
    },
  };
  const sources = providers.map((provider) => (provider === "codex" ? flaky : ok(provider)));
  const { cli, stdout } = setup(sources, { stopAfter: 3 });

  assert.equal(await cli.run(["watch"]), 0);
  assert.equal(stdout.length, providers.length * 3);
  const codexLines = stdout.filter((line) => line.startsWith("codex:"));
  assert.equal(codexLines.length, 3);
  assert.ok(codexLines[0]!.includes(": ok "));
  assert.match(codexLines[1]!, /error \[timeout\]/);
  assert.ok(codexLines[2]!.includes(": ok "));
});
