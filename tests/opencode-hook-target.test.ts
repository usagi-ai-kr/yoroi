import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yoroi-target-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'scripts'));
  const script = path.join(root, 'scripts/opencode-hook.mjs');
  await fs.copyFile(new URL('../scripts/opencode-hook.mjs', import.meta.url), script);
  await fs.cp(new URL('../integrations/opencode/', import.meta.url), path.join(root, 'integrations/opencode'), { recursive: true });
  const source = path.join(root, 'integrations/opencode-v2'); await fs.mkdir(source);
  const v2 = '// yoroi-managed: opencode-zen-free v2\nexport default {};\n';
  await fs.writeFile(path.join(source, 'yoroi-zen-free.js'), v2);
  const config = path.join(root, 'config'), plugins = path.join(config, 'plugins');
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args, '--config-dir', config], {
    encoding: 'utf8', env: { ...process.env, OPENCODE_CONFIG_DIR: '', HOME: root } });
  return { root, config, plugins, run, source, v2, entry: path.join(plugins, 'yoroi-zen-free.js') };
}
test('v2 dry-run and install use one file; status detects target without source; uninstall ignores target', async t => {
  const f = await fixture(t);
  assert.equal(f.run('install', '--target', 'v2', '--dry-run').status, 0);
  await assert.rejects(fs.stat(f.config));
  assert.equal(f.run('install', '--target', 'v2').status, 0);
  assert.deepEqual(await fs.readdir(f.plugins), ['yoroi-zen-free.js']);
  assert.equal(await fs.readFile(f.entry, 'utf8'), f.v2);
  await fs.rm(f.source, { recursive: true });
  assert.match(f.run('status').stdout, /installed target=v2/);
  assert.equal(f.run('uninstall').status, 0);
  assert.match(f.run('status').stdout, /absent/);
});
test('both target switches reject before mutation; force switches remove obsolete helpers', async t => {
  const f = await fixture(t);
  assert.equal(f.run('install').status, 0);
  assert.match(f.run('status').stdout, /installed target=v1/);
  const original = await fs.readFile(f.entry, 'utf8');
  assert.equal(f.run('install', '--target', 'v2').status, 1);
  assert.equal(f.run('install', '--target', 'v2', '--dry-run').status, 1);
  assert.equal(await fs.readFile(f.entry, 'utf8'), original);
  await fs.writeFile(path.join(f.plugins, 'foreign.js'), '// foreign');
  assert.equal(f.run('install', '--target', 'v2', '--force').status, 0);
  await assert.rejects(fs.stat(path.join(f.plugins, 'yoroi')));
  assert.equal(f.run('install', '--target', 'v1').status, 1);
  assert.equal(await fs.readFile(f.entry, 'utf8'), f.v2);
  assert.equal(f.run('install', '--target', 'v1', '--force').status, 0);
  assert.equal((await fs.readdir(path.join(f.plugins, 'yoroi'))).length, 3);
  await fs.unlink(path.join(f.plugins, 'yoroi/state.js'));
  assert.match(f.run('status', '--target', 'v2').stdout, /partial target=v1/);
  assert.equal(f.run('install').status, 0);
  assert.equal(await fs.readFile(path.join(f.plugins, 'foreign.js'), 'utf8'), '// foreign');
});
test('force cannot overwrite unmanaged helpers; uninstall accepts any managed marker version', async t => {
  const f = await fixture(t);
  assert.equal(f.run('install').status, 0);
  const helper = path.join(f.plugins, 'yoroi/state.js'); await fs.writeFile(helper, '// foreign helper');
  assert.equal(f.run('install', '--target', 'v2', '--force').status, 1);
  assert.match(await fs.readFile(f.entry, 'utf8'), /opencode-zen-free v1/);
  await fs.writeFile(helper, '// yoroi-managed: opencode-zen-free v7\n');
  await fs.writeFile(f.entry, '// yoroi-managed: opencode-zen-free v2\n');
  assert.equal(f.run('uninstall', '--target', 'v2').status, 0);
  await assert.rejects(fs.stat(f.entry));
  assert.equal(f.run('install', '--target', 'v3').status, 1);
  assert.equal(f.run('install', '--target').status, 1);
});
