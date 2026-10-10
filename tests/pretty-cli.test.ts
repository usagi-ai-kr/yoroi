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

test("duplicate --pretty or invalid combinations return code 2 with usage", async () => {
  const invalid = [
    ["once", "--pretty", "--pretty"],
    ["once", "--pretty", "extra"],
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
  assert.doesNotMatch(help, /watch/);
});
