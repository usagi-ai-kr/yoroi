import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { stat } from 'node:fs/promises';
import './harness-setup.mjs';
import { compose } from '../src/composition-root.js';
import { dataEnvironment } from '../src/composition/data-env.js';
import { openUsagePersistence } from '../src/composition/cache.js';
import { createSnapshot } from '../src/domain/usage.js';

test('test setup forcibly replaces inherited data directory before app imports', () => {
  assert.ok(process.env.YOROI_TEST_DATA_ROOT);
  const result = execFileSync(process.execPath, ['--import', './tests/harness-setup.mjs', '-e',
    'console.log(process.env.YOROI_DATA_DIR.startsWith(process.env.YOROI_TEST_DATA_ROOT))'],
  { env: { ...process.env, YOROI_DATA_DIR: join(homedir(), '.local/share/yoroi') }, encoding: 'utf8' });
  assert.equal(result.trim(), 'true');
});
test('provider-only environment inherits safe data path; explicit dataDir wins', () => {
  assert.equal(dataEnvironment({ YOROI_PROVIDERS: 'claude' }).YOROI_DATA_DIR, process.env.YOROI_DATA_DIR);
  const dir = join(process.env.YOROI_TEST_DATA_ROOT!, 'explicit');
  assert.equal(dataEnvironment({ YOROI_DATA_DIR: '/forbidden' }, dir).YOROI_DATA_DIR, dir);
});
test('standalone node:test child forces inherited home data to a temp directory', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_TEST_CONTEXT: 'child-v8',
    YOROI_DATA_DIR: join(homedir(), '.local/share/yoroi') };
  delete env.YOROI_TEST_DATA_ROOT; delete env.NODE_OPTIONS;
  const code = 'const {dataEnvironment}=await import("./src/composition/data-env.ts"); console.log(dataEnvironment().YOROI_DATA_DIR)';
  const result = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code],
    { env, encoding: 'utf8' }).trim();
  assert.ok(result.startsWith(join(tmpdir(), 'yoroi-test-data-')));
});
test('Cucumber execution also forces a temp data directory without the harness', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, YOROI_DATA_DIR: join(homedir(), '.local/share/yoroi') };
  delete env.YOROI_TEST_DATA_ROOT; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
  const code = 'process.argv.push("node_modules/@cucumber/cucumber/bin/cucumber.js"); const {dataEnvironment}=await import("./src/composition/data-env.ts"); console.log(dataEnvironment().YOROI_DATA_DIR)';
  const result = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code],
    { env, encoding: 'utf8' }).trim();
  assert.ok(result.startsWith(join(tmpdir(), 'yoroi-test-data-')));
});
test('harness falls back to homedir when userInfo cannot resolve the account', () => {
  const code = 'import os from "node:os"; import {syncBuiltinESMExports} from "node:module"; os.userInfo=()=>{throw Error("no passwd entry")}; syncBuiltinESMExports(); await import("./tests/harness-setup.mjs"); console.log("ready")';
  const env = { ...process.env }; delete env.NODE_OPTIONS;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '-e', code],
    { env, encoding: 'utf8' }).trim(), 'ready');
});
test('real HOME data access fails before composition or SQLite can touch a file', async () => {
  const realDir = join(homedir(), '.local/share/yoroi');
  assert.throws(() => existsSync(realDir), /Real HOME Yoroi data access is forbidden/);
  assert.throws(() => openUsagePersistence({ YOROI_DATA_DIR: realDir }), /forbidden/);
  await assert.rejects(stat(realDir), /Real HOME Yoroi data access is forbidden/);
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  assert.throws(() => new DatabaseSync(join(realDir, 'yoroi.db')), /must be temporary/);
  await assert.rejects(compose({ dataDir: realDir }).run(['once']), /temporary data directory/);
  await assert.rejects(compose({ dataDir: realDir }).run(['zen-free', 'status']), /temporary data directory/);
});
test('independent composition dataDir injections never share cached success', async t => {
  const root = mkdtempSync(join(tmpdir(), 'yoroi-composition-isolation-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let reads = 0;
  const options = { configEnv: { YOROI_PROVIDERS: 'claude' },
    factories: { claude: () => ({ provider: 'claude' as const, read: async () => {
      reads++; return createSnapshot('claude', new Date().toISOString(), []);
    } }) }, output: { stdout() {}, stderr() {} }, subscribeSignals: () => () => {} };
  assert.equal(await compose({ ...options, dataDir: join(root, 'first') }).run(['once']), 0);
  assert.equal(await compose({ ...options, dataDir: join(root, 'second') }).run(['once']), 0);
  assert.equal(reads, 2);
});
