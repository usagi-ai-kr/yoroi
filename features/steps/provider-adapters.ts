import assert from "node:assert/strict";
import { Given, Then } from "@cucumber/cucumber";
import { world } from "./cli-world.js";
import { fakeTransport, installRealAdapters } from "./provider-adapters-world.js";

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

Then("the adapter output contains {int} provider result headers", (count: number) => {
  const headers = world.stdout.filter((line) => line.includes(": ok observed="));
  assert.equal(headers.length, count, `expected ${count} headers, got ${headers.length}`);
});
