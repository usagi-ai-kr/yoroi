import assert from "node:assert/strict";
import test from "node:test";
import { createCli } from "../src/ui/cli/bootstrap.js";

test("watch reports removal guidance and exits with an argument error", async () => {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const cli = createCli({
    env: { stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
    sources: [],
    subscribeSignals: () => () => {},
  });
  assert.equal(await cli.run(["watch"]), 2);
  assert.equal(stdout.length, 0);
  assert.match(stderr.join("\n"), /watch command removed/i);
  assert.match(stderr.join("\n"), /yoroi once/i);
});
