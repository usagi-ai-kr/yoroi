import assert from "node:assert/strict";
import { Given, Then } from "@cucumber/cucumber";
import { world } from "./cli-world.js";
import { fakeTransport, installRealAdapters, ollamaActivityBody } from "./provider-adapters-world.js";

Given("the five real provider adapters with fake transports", () => {
  installRealAdapters();
});

Given("real adapter {string} receives HTTP status {int}", (provider: string, status: number) => {
  assert.equal(provider, "opencode-go");
  fakeTransport.opencodeStatus = status;
});

Given("real adapter {string} CLI exits with code {int}", (provider: string, code: number) => {
  assert.equal(provider, "agy");
  fakeTransport.agyExitCode = code;
});

Given("real adapter {string} payload omits the monthly window", (provider: string) => {
  assert.equal(provider, "ollama-pro");
  fakeTransport.ollamaBody = JSON.stringify({
    limits: { session: { usage: 0.25 }, weekly: { usage: 0.6 } },
    activity: { cost: "1.23" },
  });
});

Given("real adapter {string} uses the current activity schema", (provider: string) => {
  assert.equal(provider, "ollama-pro");
  fakeTransport.ollamaBody = ollamaActivityBody;
});

Then("the CLI stdout does not contain {string}", (text: string) => {
  assert.ok(!world.stdout.join("\n").includes(text),
    `expected stdout not to contain "${text}", but found in:\n${world.stdout.join("\n")}`);
});

Then("the ollama-pro header reports {int} windows", (count: number) => {
  assert.ok(world.stdout.some((line) => line.startsWith("ollama-pro: ok") &&
    line.endsWith(`windows=${count}`)), `missing ollama-pro windows=${count} in:\n${world.stdout.join("\n")}`);
});

Then("the adapter output contains {int} provider result headers", (count: number) => {
  const headers = world.stdout.filter((line) => line.includes(": ok observed="));
  assert.equal(headers.length, count, `expected ${count} headers, got ${headers.length}`);
});
