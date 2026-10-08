import assert from "node:assert/strict";
import { test } from "node:test";
import { createCli, type CliDependencies } from "../src/ui/cli/bootstrap.js";

function build() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const deps: CliDependencies = {
    env: {
      stdout: (text: string) => stdout.push(text),
      stderr: (text: string) => stderr.push(text),
    },
    sources: [],
    scheduler: { sleep: async () => {} },
    subscribeSignals: () => () => {},
  };
  return { cli: createCli(deps), stdout, stderr };
}

test("알 수 없는 명령은 stderr에 사용법을 출력하고 코드 2를 반환한다", async () => {
  const { cli, stdout, stderr } = build();

  const code = await cli.run(["nope"]);

  assert.equal(code, 2);
  assert.match(stderr.join("\n"), /usage/);
  assert.equal(stdout.length, 0);
});

test("--help는 stdout에 사용법을 출력하고 코드 0을 반환한다", async () => {
  const { cli, stdout, stderr } = build();

  const code = await cli.run(["--help"]);

  assert.equal(code, 0);
  assert.match(stdout.join("\n"), /usage/);
  assert.equal(stderr.length, 0);
});
