import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { compose } from "../../src/composition-root.js";
import { providers } from "../../src/domain/usage.js";
import type { Scheduler } from "../../src/app/watch-usage.js";
import { DefaultProvidersWorld, createFactories } from "./default-providers-world.js";

const world = new DefaultProvidersWorld();

Given("default configuration without YOROI_PROVIDERS", () => {
  world.reset();
  world.configEnv = { YOROI_OPENCODE_GO_API_KEY: "dummy-key", YOROI_OLLAMA_PRO_SIGNING_KEY_PATH: "valid" };
});

Given("all 5 providers succeed in composition", () => {});

Given("default configuration without credentials", () => {
  world.reset();
  world.configEnv = { HOME: "" };
});

Given("API providers fail with authentication while others succeed", () => {});

Given("default composition with {int}ms collection delay", (delay: number) => {
  world.reset();
  world.collectionDelayMs = delay;
  world.configEnv = { YOROI_OPENCODE_GO_API_KEY: "dummy-key", YOROI_OLLAMA_PRO_SIGNING_KEY_PATH: "valid" };
});

Given("composed scheduler stops after {int} cycles", (cycles: number) => {
  world.stopAfter = cycles;
});

When("I run composed CLI {string}", async (cmd: string) => {
  const scheduler: Scheduler = {
    sleep: async (ms) => {
      assert.equal(world.activeQueries, 0, "no queries during sleep");
      world.timeline.push({ kind: "sleep_start", time: world.clock });
      world.sleepIntervals.push(ms);
      world.clock += ms;
      world.timeline.push({ kind: "sleep_end", time: world.clock });
      world.cyclesCompleted++;
      if (world.stopAfter !== null && world.cyclesCompleted >= world.stopAfter) world.handler?.();
    },
  };
  const cli = compose({
    configEnv: world.configEnv,
    factories: createFactories(world),
    output: { stdout: (t) => world.stdout.push(t), stderr: () => {} },
    scheduler,
    subscribeSignals: (h) => { world.handler = h; return () => {}; },
  });
  world.exitCode = await cli.run(cmd.trim().split(/\s+/));
});

Then("the composed CLI exit code is {int}", (c: number) => assert.equal(world.exitCode, c));

Then("composed stdout contains all 5 provider results", () => {
  for (const p of providers) assert.ok(world.stdout.some((l) => l.startsWith(`${p}: ok`)), `missing ${p}`);
});

Then("composed stdout contains {string}", (text: string) => {
  assert.ok(world.stdout.join("\n").includes(text), `missing ${text}`);
});

Then("each sleep interval is {int} ms nonoverlapping", (ms: number) => {
  assert.ok(world.sleepIntervals.length > 0 && world.sleepIntervals.every((s) => s === ms));
  const starts = world.timeline.filter((e) => e.kind === "sleep_start");
  const ends = world.timeline.filter((e) => e.kind === "collection_end");
  assert.ok(starts[0] && ends[0] && starts[0].time >= ends[0].time);
});

Then("timeline confirms cycle 1 from 0 to 50 and cycle 2 from 60050", () => {
  const summary = world.timeline.map((e) => `${e.kind}:${e.time}`);
  assert.deepEqual(summary, [
    "cycle_start:0", "collection_end:50", "sleep_start:50", "sleep_end:60050",
    "cycle_start:60050", "collection_end:60100", "sleep_start:60100", "sleep_end:120100",
  ]);
});
