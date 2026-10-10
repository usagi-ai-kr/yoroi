import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { compose } from "../../src/composition-root.js";
import { providers } from "../../src/domain/usage.js";
import { DefaultProvidersWorld, createFactories } from "./default-providers-world.js";

const world = new DefaultProvidersWorld();

Given("default configuration without YOROI_PROVIDERS", () => {
  world.reset();
  world.configEnv = { YOROI_OPENCODE_GO_API_KEY: "dummy-key",
    YOROI_OLLAMA_PRO_SIGNING_KEY_PATH: "valid", YOROI_CLAUDE_OAUTH_TOKEN: "fake-claude-token" };
});
Given("all 5 providers succeed in composition", () => {});
Given("default configuration without credentials", () => {
  world.reset();
  world.configEnv = { HOME: "" };
});
Given("API providers fail with authentication while others succeed", () => {});

When("I run composed CLI {string}", async (cmd: string) => {
  const cli = compose({ configEnv: world.configEnv, dataDir: process.env.YOROI_DATA_DIR!, factories: createFactories(),
    output: { stdout: text => world.stdout.push(text), stderr: () => {} } });
  world.exitCode = await cli.run(cmd.trim().split(/\s+/));
});

Then("the composed CLI exit code is {int}", (code: number) => assert.equal(world.exitCode, code));
Then("composed stdout contains all 5 provider results", () => {
  for (const provider of providers) assert.ok(world.stdout.some(line => line.startsWith(`${provider}: ok`)));
});
Then("composed stdout contains {string}", (text: string) => {
  assert.ok(world.stdout.join("\n").includes(text), `missing ${text}`);
});
