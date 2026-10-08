import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { createCli } from "../../src/ui/cli/bootstrap.js";

let stdout: string[] = [];
let stderr: string[] = [];
let exitCode = 0;

Given("fake CLI environment", function () {
  stdout = [];
  stderr = [];
  exitCode = 0;
});

When("I run command {string}", async function (command: string) {
  const cli = createCli({
    env: {
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
    sources: [],
    scheduler: { sleep: async () => {} },
    subscribeSignals: () => () => {},
  });
  exitCode = await cli.run([command]);
});

Then("exit code is {int}", function (expected: number) {
  assert.equal(exitCode, expected);
});

Then("stderr contains {string}", function (text: string) {
  assert.match(stderr.join("\n"), new RegExp(text, "i"));
});

Then("stdout contains {string}", function (text: string) {
  assert.match(stdout.join("\n"), new RegExp(text, "i"));
});
