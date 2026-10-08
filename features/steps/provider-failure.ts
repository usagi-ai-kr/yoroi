import assert from "node:assert/strict";
import { Given, Then, When } from "@cucumber/cucumber";
import { collectOnce } from "../../src/app/collect-once.js";
import { world } from "./cli-world.js";
import { adapterResults, fakeTransport, installRealAdapters } from "./provider-adapters-world.js";

Given("the real adapters with Ollama authentication rejected", () => {
  installRealAdapters();
  fakeTransport.ollamaStatus = 401;
});

Given("the real adapters with a changed Ollama response format", () => {
  installRealAdapters();
  fakeTransport.ollamaBody = JSON.stringify({ unexpected: true });
});

When("the adapters collect once", async () => {
  adapterResults.push(...await collectOnce(world.sources));
});

Then("5 adapter results contain 1 error with code {string}", (code: string) => {
  assert.equal(adapterResults.length, 5);
  const errors = adapterResults.filter((result) => "error" in result);
  assert.equal(errors.length, 1);
  assert.equal(errors[0] && "error" in errors[0] ? errors[0].error.code : undefined, code);
});

Then("4 adapter results contain a snapshot", () => {
  const snapshots = adapterResults.filter((result) => "snapshot" in result);
  assert.equal(snapshots.length, 4);
});
