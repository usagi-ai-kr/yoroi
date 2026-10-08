import assert from "node:assert/strict";
import { Given, Then } from "@cucumber/cucumber";
import { allProviders, okSource, resetWorld, world } from "./cli-world.js";
import { claudeWire, createClaudeSource, resetClaudeWire, usageUrl } from "./claude-readonly-world.js";

Given("the claude read-only source with four fake providers", () => {
  resetWorld();
  resetClaudeWire();
  world.sources = [
    ...allProviders.filter((provider) => provider !== "claude").map((provider) => okSource(provider)),
    createClaudeSource(),
  ];
});

Given("claude usage fails with HTTP status {int} on request {int}", (status: number, request: number) => {
  claudeWire.failStatus = status;
  claudeWire.failOn = request;
});

Then("claude usage requests are {int}", (count: number) => {
  assert.equal(claudeWire.requests.length, count);
});

Then("every claude usage request is a GET without body", () => {
  assert.ok(claudeWire.requests.length > 0, "no usage request was made");
  for (const request of claudeWire.requests) {
    assert.equal(request.method, "GET");
    assert.equal(request.url, usageUrl);
    assert.equal(request.body, undefined);
  }
});

Then("stdout lines starting with {string} are {int}", (prefix: string, count: number) => {
  assert.equal(world.stdout.filter((line) => line.startsWith(prefix)).length, count);
});
