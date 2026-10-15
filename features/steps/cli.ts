import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { Given, Then, When } from "@cucumber/cucumber";
import type { SourceErrorCode } from "../../src/app/usage-source.js";
import {
  allProviders, failingSource, okSource, percentSource, resetWorld, runCli, windowSource, world,
} from "./cli-world.js";

function succeedAll(): void {
  resetWorld();
  world.sources = allProviders.map((provider) => okSource(provider));
}

Given("all 6 fake providers succeed", () => {
  succeedAll();
});

Given("all 6 fake providers fail", () => {
  resetWorld();
  world.sources = allProviders.map((provider) => failingSource(provider));
});

Given("provider {string} fails with {string}", (provider: string, code: string) => {
  succeedAll();
  world.sources = allProviders.map((id) =>
    (id === provider ? failingSource(id, code as SourceErrorCode) : okSource(id)));
});

Given("provider {string} reports window {string} with used={int} limit={int}",
  (provider: string, id: string, used: number, limit: number) => {
    succeedAll();
    world.sources = allProviders.map((pid) =>
      (pid === provider ? windowSource(pid, id, used, limit) : okSource(pid)));
  });

Given("provider {string} reports window {string} with percent={int}",
  (provider: string, id: string, percent: number) => {
    succeedAll();
    world.sources = allProviders.map((pid) =>
      (pid === provider ? percentSource(pid, id, percent) : okSource(pid)));
  });

When("I run {string}", async (commandLine: string) => {
  await runCli(commandLine.trim().split(/\s+/));
});

Then("the CLI exit code is {int}", (expected: number) => {
  assert.equal(world.exitCode, expected);
});

Then("the CLI stdout contains {string}", (text: string) => {
  const stdout = stripVTControlCharacters(world.stdout.join("\n"));
  assert.ok(stdout.includes(text), `missing "${text}" in:\n${stdout}`);
});

Then("the CLI stderr contains {string}", (text: string) => {
  assert.ok(world.stderr.join("\n").includes(text), `missing "${text}" in:\n${world.stderr.join("\n")}`);
});

Then("stdout has results for providers {string}", (list: string) => {
  for (const provider of list.split(",")) {
    assert.ok(world.stdout.some((line) => line.startsWith(`${provider}: ok`)), `missing ok for ${provider}`);
  }
});
