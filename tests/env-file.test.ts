import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnvFile, packageRootFrom } from "../src/config/env-file.js";
const withTemp = (fn: (root: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "yoroi-env-"));
  try { fn(root); } finally { rmSync(root, { recursive: true, force: true }); }
};
const writeEnv = (dir: string, body: string): string => {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, ".env");
  writeFileSync(path, body);
  return path;
};
const noop = (): void => {};
test("prefers cwd/.env over the package root", () => withTemp((root) => {
  const cwd = join(root, "cwd");
  const cwdEnv = writeEnv(cwd, "YOROI_ENV_CWD=1\n");
  writeEnv(root, "YOROI_ENV_ROOT=1\n");
  const loaded: string[] = [], logs: string[] = [];
  const result = loadEnvFile({ cwd, packageRoot: root, env: {}, debug: true,
    load: (path) => { loaded.push(path); }, log: (line) => { logs.push(line); } });
  assert.equal(result, cwdEnv);
  assert.deepEqual(loaded, [cwdEnv]);
  assert.deepEqual(logs, [`yoroi: env file ${cwdEnv}`]);
}));

test("falls back to the package root when cwd has none", () => withTemp((root) => {
  mkdirSync(join(root, "cwd"), { recursive: true });
  const rootEnv = writeEnv(root, "YOROI_ENV_ROOT=1\n");
  assert.equal(loadEnvFile({ cwd: join(root, "cwd"), packageRoot: root, env: {}, load: noop, log: noop }), rootEnv);
}));

test("skips a dist package.json and reads the real package root .env", () => withTemp((root) => {
  mkdirSync(join(root, "dist", "src", "config"), { recursive: true });
  writeFileSync(join(root, "package.json"), "{}");
  writeFileSync(join(root, "dist", "package.json"), "{}");
  const rootEnv = writeEnv(root, "YOROI_ENV_ROOTFIX=1\n");
  const moduleUrl = pathToFileURL(join(root, "dist", "src", "config", "env-file.js")).href;
  assert.equal(packageRootFrom(moduleUrl), root);
  assert.equal(loadEnvFile({ cwd: join(root, "cwd"), packageRoot: packageRootFrom(moduleUrl),
    env: {}, load: noop, log: noop }), rootEnv);
}));

test("skips silently only when no candidate exists", () => withTemp((root) => {
  const logs: string[] = [];
  const result = loadEnvFile({ cwd: join(root, "cwd"), packageRoot: join(root, "pkg"),
    env: {}, debug: true, load: () => assert.fail("load must not run"), log: (l) => { logs.push(l); } });
  assert.equal(result, undefined);
  assert.deepEqual(logs, ["yoroi: env file none"]);
}));

test("does not overwrite an already set environment variable", () => withTemp((root) => {
  const key = "YOROI_ENV_PRECEDENCE";
  const previous = process.env[key];
  try {
    const path = writeEnv(root, `${key}=fromfile\n`);
    process.env[key] = "fromenv";
    const loaded = loadEnvFile({ cwd: root, packageRoot: join(root, "pkg"), env: process.env });
    assert.equal(loaded, path);
    assert.equal(process.env[key], "fromenv");
  } finally {
    if (previous === undefined) delete process.env[key]; else process.env[key] = previous;
  }
}));

test("debug output contains only the path, never values", () => withTemp((root) => {
  const secret = "SYNTHETIC_SECRET_VALUE";
  const path = writeEnv(join(root, "cwd"), `YOROI_ENV_DEBUG_SECRET=${secret}\n`);
  const logs: string[] = [];
  loadEnvFile({ cwd: join(root, "cwd"), packageRoot: root, env: {}, debug: true,
    load: noop, log: (l) => { logs.push(l); } });
  assert.deepEqual(logs, [`yoroi: env file ${path}`]);
  assert.ok(!logs[0]!.includes(secret));
}));

test("fails path-only when an existing .env cannot be read", () => withTemp((root) => {
  const secret = "SYNTHETIC_READ_SECRET";
  const path = writeEnv(join(root, "cwd"), `YOROI_ENV_READ=${secret}\n`);
  chmodSync(path, 0o000);
  const logs: string[] = [];
  assert.throws(() => loadEnvFile({ cwd: join(root, "cwd"), packageRoot: root, env: {},
    log: (l) => { logs.push(l); } }));
  assert.equal(logs.length, 1);
  assert.ok(logs[0]!.startsWith(`yoroi: env file load failed ${path} (`) && logs[0]!.endsWith(")"));
  assert.ok(!logs[0]!.includes(secret));
}));

test("classifies parse failures without raw messages or values", () => withTemp((root) => {
  const secret = "SYNTHETIC_PARSE_SECRET";
  const path = writeEnv(join(root, "cwd"), `YOROI_ENV_PARSE=${secret}\n`);
  const logs: string[] = [];
  assert.throws(() => loadEnvFile({ cwd: join(root, "cwd"), packageRoot: root, env: {},
    load: () => { throw new Error("synthetic raw message"); }, log: (l) => { logs.push(l); } }));
  assert.deepEqual(logs, [`yoroi: env file load failed ${path} (parse)`]);
  assert.ok(!logs[0]!.includes(secret) && !logs[0]!.includes("synthetic raw message"));
}));
