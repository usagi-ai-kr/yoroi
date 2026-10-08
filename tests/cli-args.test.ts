import assert from "node:assert/strict";
import test from "node:test";
import { SourceError, type UsageSource } from "../src/app/usage-source.js";
import type { Scheduler } from "../src/app/watch-usage.js";
import { createSnapshot, providers, type ProviderId } from "../src/domain/usage.js";
import { createCli } from "../src/ui/cli/bootstrap.js";
import { parseArgs } from "../src/ui/cli/args.js";

const observedAt = "2026-10-07T00:00:00Z";
const ok = (provider: ProviderId): UsageSource =>
  ({ provider, read: async () => createSnapshot(provider, observedAt, []) });
const bad = (provider: ProviderId): UsageSource =>
  ({ provider, read: async () => { throw new SourceError("timeout"); } });

function setup(sources: readonly UsageSource[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const scheduler: Scheduler = { sleep: async () => {} };
  const cli = createCli({
    env: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    sources,
    scheduler,
    subscribeSignals: () => () => {},
  });
  return { cli, stdout, stderr };
}

test("once prints all 5 providers with observedAt in stable order and succeeds", async () => {
  const { cli, stdout } = setup(providers.map(ok));
  assert.equal(await cli.run(["once"]), 0);
  assert.deepEqual(stdout, providers.map((provider) =>
    `${provider}: ok observed=${observedAt} windows=0 (no usage windows reported)`));
});

test("once prints window metrics and marks missing values unknown", async () => {
  const windowed: UsageSource = {
    provider: "codex",
    read: async () => createSnapshot("codex", observedAt,
      [{ id: "weekly", unit: "requests", used: 3, limit: 10 }]),
  };
  const sources = providers.map((provider) => (provider === "codex" ? windowed : ok(provider)));
  const { cli, stdout } = setup(sources);
  const expected = "  - weekly [requests] usage_status=n/a used=3 remaining=unknown" +
    " limit=10 percent=unknown reset=unknown reset_in=unknown";

  assert.equal(await cli.run(["once"]), 0);
  assert.ok(stdout.includes(`codex: ok observed=${observedAt} windows=1`));
  assert.ok(stdout.includes(expected));
});

test("once keeps partial success at exit 0 and prints the error line", async () => {
  const sources = providers.map((provider) => (provider === "codex" ? bad(provider) : ok(provider)));
  const { cli, stdout } = setup(sources);
  assert.equal(await cli.run(["once"]), 0);
  assert.ok(stdout.includes("codex: error [timeout] Usage query timed out"));
  assert.equal(stdout.length, providers.length);
});

test("once returns 1 when every provider fails", async () => {
  assert.equal(await setup(providers.map(bad)).cli.run(["once"]), 1);
});

test("argument errors return 2 with usage on stderr", async () => {
  const invalid = [[], ["nope"], ["once", "extra"], ["watch", "--interval"],
    ["watch", "--interval", "0"], ["watch", "--interval", "abc"],
    ["watch", "--interval", "-1"], ["watch", "--interval", "86401"]];
  for (const argv of invalid) {
    const { cli, stderr } = setup(providers.map(ok));
    assert.equal(await cli.run(argv), 2, argv.join(" "));
    assert.match(stderr.join("\n"), /usage/);
  }
});

test("interval accepts fractional seconds and the 86400s cap, rejects beyond", () => {
  assert.deepEqual(parseArgs(["watch", "--interval", "0.5"]), { kind: "watch", intervalMs: 500 });
  assert.deepEqual(parseArgs(["watch", "--interval", "86400"]),
    { kind: "watch", intervalMs: 86_400_000 });
  assert.equal(parseArgs(["watch", "--interval", "86401"]).kind, "error");
});

test("short and long help and version flags behave the same", () => {
  for (const argv of [["--help"], ["-h"]]) assert.deepEqual(parseArgs(argv), { kind: "help" });
  for (const argv of [["--version"], ["-v"]]) assert.deepEqual(parseArgs(argv), { kind: "version" });
  assert.equal(parseArgs(["--version", "extra"]).kind, "error");
  assert.equal(parseArgs(["-h", "extra"]).kind, "help", "help은 뒤 인자를 무시하고 출력");
  const cases = [["once", "--help"], ["watch", "--help"], ["once", "--pretty", "--pretty"]];
  for (const argv of cases) {
    const parsed = parseArgs(argv);
    assert.equal(parsed.kind, "error", argv.join(" "));
    assert.match(parsed.kind === "error" ? parsed.message : "", /unexpected argument/);
  }
});

test("help succeeds and empty configuration is a config error", async () => {
  const { cli, stdout, stderr } = setup([]);
  assert.equal(await cli.run(["--help"]), 0);
  assert.match(stdout.join("\n"), /usage/);
  assert.equal(await cli.run(["once"]), 2);
  assert.match(stderr.join("\n"), /no providers configured/);
});
