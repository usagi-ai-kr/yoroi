import assert from "node:assert/strict";
import test from "node:test";
import { createCli } from "../src/ui/cli/bootstrap.js";

const SECRET_PATTERN = /(token|key|secret|password|bearer|auth|session|credential)[[:space:]]*[:=]/i;

function runHelp(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const cli = createCli({
    env: { stdout: (t) => stdout.push(t), stderr: (t) => stderr.push(t) },
    sources: [],
    subscribeSignals: () => () => {},
  });
  return { cli, stdout, stderr };
}

test("subcommand help for once exits 0 with usage, options, and yoroi examples", async () => {
  for (const flag of ["--help", "-h"]) {
    const { cli, stdout, stderr } = runHelp(["once", flag]);
    assert.equal(await cli.run(["once", flag]), 0);
    assert.equal(stderr.length, 0);
    const text = stdout.join("\n");
    assert.match(text, /usage: yoroi once/);
    assert.match(text, /options:/);
    assert.match(text, /--pretty/);
    assert.match(text, /-h, --help/);
    assert.match(text, /yoroi once --pretty/);
    assert.ok(!text.includes("pnpm"), "pnpm string must not appear in help");
    assert.ok(!SECRET_PATTERN.test(text), "no secret patterns in help");
  }
});

test("help takes priority when mixed with other valid options", async () => {
  const cases = [
    { argv: ["once", "--pretty", "--help"], expected: /usage: yoroi once/ },
    { argv: ["once", "-h", "--pretty"], expected: /usage: yoroi once/ },
  ];
  for (const { argv, expected } of cases) {
    const { cli, stdout, stderr } = runHelp(argv);
    assert.equal(await cli.run(argv), 0);
    assert.equal(stderr.length, 0);
    assert.match(stdout.join("\n"), expected);
  }
});

test("top-level help preserves exit 0, yoroi examples, and no pnpm string", async () => {
  for (const flag of ["--help", "-h"]) {
    const { cli, stdout, stderr } = runHelp([flag]);
    assert.equal(await cli.run([flag]), 0);
    assert.equal(stderr.length, 0);
    const text = stdout.join("\n");
    assert.match(text, /usage: yoroi <once\|zen-free>/);
    assert.match(text, /yoroi once --pretty/);
    assert.doesNotMatch(text, /watch/);
    assert.ok(!text.includes("pnpm"), "top-level help has no pnpm string");
    assert.ok(!SECRET_PATTERN.test(text), "no secret patterns in help");
  }
});
