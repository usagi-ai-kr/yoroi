import assert from "node:assert/strict";
import { Given, Then } from "@cucumber/cucumber";
import { allProviders, flakySource, okSource, resetWorld, world } from "./cli-world.js";

Given("fake scheduler stops after {int} sleeps", (count: number) => {
  world.stopAfter = count;
});

Given("provider {string} fails on read 2 then succeeds", (provider: string) => {
  resetWorld();
  world.sources = allProviders.map((id) => (id === provider ? flakySource(id) : okSource(id)));
});

Then("scheduler slept {string}", (list: string) => {
  assert.deepEqual(world.sleeps, list.split(",").map(Number));
});

Then("the signal subscription is cleaned up", () => {
  assert.equal(world.unsubscribed, true);
});

Then("stdout has {int} result lines", (count: number) => {
  assert.equal(world.stdout.length, count);
});

Then("{string} result {int} is an error", (provider: string, index: number) => {
  const lines = world.stdout.filter((line) => line.startsWith(`${provider}:`));
  assert.ok(lines[index - 1]?.includes("error"), `${provider} result ${index} was not an error`);
});

Then("{string} result {int} is ok", (provider: string, index: number) => {
  const lines = world.stdout.filter((line) => line.startsWith(`${provider}:`));
  assert.ok(lines[index - 1]?.includes(": ok "), `${provider} result ${index} was not ok`);
});
