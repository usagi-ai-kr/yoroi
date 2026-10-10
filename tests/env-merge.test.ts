import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { loadEnvFile } from "../src/config/env-file.js";

type Env = Record<string, string | undefined>;
const withTemp = (fn: (cwd: string, pkg: string) => void): void => {
  const root = mkdtempSync(join(tmpdir(), "yoroi-merge-"));
  try { fn(join(root, "cwd"), join(root, "pkg")); } finally { rmSync(root, { recursive: true, force: true }); }
};
const put = (dir: string, body: string): string => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, ".env"), body);
  return join(dir, ".env");
};
/** process.loadEnvFile와 같은 비덮어쓰기 규칙을 주입 env에 적용한다. */
const loader = (env: Env, order: string[] = []) => (path: string): void => {
  order.push(path);
  for (const [key, value] of Object.entries(parseEnv(readFileSync(path, "utf8")))) env[key] ??= value;
};

test("cwd .env wins over the install copy for the same key", () => withTemp((cwd, pkg) => {
  put(cwd, "YOROI_PROVIDERS=codex\n");
  put(pkg, "YOROI_PROVIDERS=agy\n");
  const env: Env = {};
  loadEnvFile({ cwd, packageRoot: pkg, env, load: loader(env) });
  assert.equal(env.YOROI_PROVIDERS, "codex");
}));

test("keys missing from cwd .env are filled from the install copy", () => withTemp((cwd, pkg) => {
  put(cwd, "GEMINI_API_KEY=synthetic-gemini\n");
  put(pkg, "YOROI_OPENCODE_GO_API_KEY=synthetic-opencode\n");
  const env: Env = {}, order: string[] = [];
  const loaded = loadEnvFile({ cwd, packageRoot: pkg, env, load: loader(env, order) });
  assert.deepEqual(loaded, [join(cwd, ".env"), join(pkg, ".env")]);
  assert.deepEqual(order, loaded);
  assert.equal(env.GEMINI_API_KEY, "synthetic-gemini");
  assert.equal(env.YOROI_OPENCODE_GO_API_KEY, "synthetic-opencode");
}));

test("real environment variables beat both files", () => withTemp((cwd, pkg) => {
  put(cwd, "YOROI_TIMEOUT_MS=1\n");
  put(pkg, "YOROI_TIMEOUT_MS=2\nYOROI_TEST_SETTING=3\n");
  const env: Env = { YOROI_TIMEOUT_MS: "9" };
  loadEnvFile({ cwd, packageRoot: pkg, env, load: loader(env) });
  assert.equal(env.YOROI_TIMEOUT_MS, "9");
  assert.equal(env.YOROI_TEST_SETTING, "3");
}));

test("neither file present is skipped silently, same path loads once", () => withTemp((cwd, pkg) => {
  const logs: string[] = [];
  assert.deepEqual(loadEnvFile({ cwd, packageRoot: pkg, env: {}, log: (l) => { logs.push(l); },
    load: () => assert.fail("load must not run") }), []);
  assert.deepEqual(logs, []);
  const path = put(cwd, "YOROI_ENV_ONCE=1\n"), order: string[] = [];
  loadEnvFile({ cwd, packageRoot: cwd, env: {}, load: (p) => { order.push(p); } });
  assert.deepEqual(order, [path]);
}));

test("a failing file stops with one path-only line and skips the rest", () => withTemp((cwd, pkg) => {
  const bad = put(cwd, "YOROI_ENV_BAD=synthetic-secret\n");
  put(pkg, "YOROI_ENV_NEXT=1\n");
  const logs: string[] = [], order: string[] = [];
  assert.throws(() => loadEnvFile({ cwd, packageRoot: pkg, env: {}, log: (l) => { logs.push(l); },
    load: (p) => { order.push(p); throw new Error("synthetic raw message"); } }), /env file load failed/);
  assert.deepEqual(order, [bad]);
  assert.deepEqual(logs, [`yoroi: env file load failed ${bad} (parse)`]);
}));

test("debug lists applied key names per file and never values", () => withTemp((cwd, pkg) => {
  const first = put(cwd, "SHARED_KEY=synthetic-one\nCWD_ONLY=synthetic-two\n");
  const second = put(pkg, "SHARED_KEY=synthetic-three\nPKG_ONLY=synthetic-four\n");
  const env: Env = {}, logs: string[] = [];
  loadEnvFile({ cwd, packageRoot: pkg, env, debug: true, load: loader(env), log: (l) => { logs.push(l); } });
  assert.deepEqual(logs, [`yoroi: env file ${first} keys=CWD_ONLY,SHARED_KEY`,
    `yoroi: env file ${second} keys=PKG_ONLY`]);
  assert.ok(!logs.join("\n").includes("synthetic"));
}));

test("process.loadEnvFile merges both files with real precedence", () => withTemp((cwd, pkg) => {
  put(cwd, "YOROI_MERGE_A=cwd\nYOROI_MERGE_B=cwd\n");
  put(pkg, "YOROI_MERGE_B=pkg\nYOROI_MERGE_C=pkg\n");
  const keys = ["YOROI_MERGE_A", "YOROI_MERGE_B", "YOROI_MERGE_C"];
  try {
    loadEnvFile({ cwd, packageRoot: pkg, env: process.env });
    assert.deepEqual(keys.map((key) => process.env[key]), ["cwd", "cwd", "pkg"]);
  } finally { for (const key of keys) delete process.env[key]; }
}));
