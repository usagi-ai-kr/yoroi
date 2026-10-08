import assert from "node:assert/strict";
import test from "node:test";
import { type UsageSource } from "../src/app/usage-source.js";
import { createSnapshot, providers, type ProviderId } from "../src/domain/usage.js";
import { createCli } from "../src/ui/cli/bootstrap.js";

const observedAt = "2026-10-07T00:00:00Z";
const ok = (provider: ProviderId): UsageSource =>
  ({ provider, read: async () => createSnapshot(provider, observedAt, []) });

function setup(sources: readonly UsageSource[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const cli = createCli({
    env: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    sources,
    scheduler: { sleep: async () => {} },
    subscribeSignals: () => () => {},
  });
  return { cli, stdout, stderr };
}

test("once --pretty prints plain box table with header and succeeds", async () => {
  const { cli, stdout } = setup(providers.map(ok));
  assert.equal(await cli.run(["once", "--pretty"]), 0);
  const out = stdout.join("\n");
  assert.ok(out.includes("Provider"));
  assert.ok(out.includes("Reset (KST)"));
  assert.ok(out.includes("ollama-pro"));
});

test("watch --pretty runs real loop, prints pretty table, and cancels cleanly on signal", async () => {
  const orderings = [
    ["watch", "--pretty", "--interval", "10"],
    ["watch", "--interval", "10", "--pretty"],
  ];
  for (const argv of orderings) {
    const stdout: string[] = [];
    let signalTrigger: (() => void) | undefined;
    let unsubscribed = false;
    const cli = createCli({
      env: {
        stdout: (text) => {
          stdout.push(text);
          if (stdout.length === 1 && signalTrigger) signalTrigger();
        },
        stderr: () => {},
      },
      sources: [ok("codex")],
      scheduler: { sleep: async () => {} },
      subscribeSignals: (handler) => {
        signalTrigger = handler;
        return () => { unsubscribed = true; };
      },
    });

    const exitCode = await cli.run(argv);
    assert.equal(exitCode, 0);
    assert.equal(unsubscribed, true);
    const text = stdout.join("\n");
    assert.ok(text.includes("Provider"));
    assert.ok(text.includes("codex"));
    assert.ok(text.includes("Reset (KST)"));
  }
});

test("duplicate --pretty or invalid combinations return code 2 with usage", async () => {
  const invalid = [
    ["once", "--pretty", "--pretty"],
    ["watch", "--pretty", "--pretty"],
    ["watch", "--pretty", "--interval", "10", "--pretty"],
    ["once", "--pretty", "extra"],
    ["watch", "--pretty", "--unknown"],
    ["watch", "--pretty", "--interval", "0"],
  ];
  for (const argv of invalid) {
    const { cli, stderr } = setup(providers.map(ok));
    assert.equal(await cli.run(argv), 2, argv.join(" "));
    assert.match(stderr.join("\n"), /usage:/);
  }
});

test("--help output contains pretty run examples", async () => {
  const { cli, stdout } = setup(providers.map(ok));
  assert.equal(await cli.run(["--help"]), 0);
  const help = stdout.join("\n");
  assert.match(help, /once --pretty/);
  assert.match(help, /watch --pretty/);
});
