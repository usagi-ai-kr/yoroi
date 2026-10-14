import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const script = fileURLToPath(new URL('../scripts/opencode-hook.mjs', import.meta.url));
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'yoroi-hook-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const config = path.join(root, 'config');
  const env = { ...process.env, HOME: root, XDG_CONFIG_HOME: path.join(root, 'xdg'),
    XDG_CACHE_HOME: path.join(root, 'cache'), OPENCODE_CONFIG_DIR: '' };
  const run = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });
  return { root, config, env, run, entry: path.join(config, 'plugins/yoroi-zen-free.js') };
}
test('dry-run writes nothing; install copies helpers and uninstall preserves other plugins', async t => {
  const f = await fixture(t);
  assert.equal(f.run('install', '--config-dir', f.config, '--dry-run').status, 0);
  await assert.rejects(fs.stat(f.config));
  assert.equal(f.run('install', '--config-dir', f.config).status, 0);
  const plugins = path.join(f.config, 'plugins');
  await fs.writeFile(path.join(plugins, 'herdr-agent-state.js'), '// foreign');
  assert.match(await fs.readFile(f.entry, 'utf8'), /^\/\/ yoroi-managed:/);
  assert.equal((await fs.readdir(path.join(plugins, 'yoroi'))).length, 3);
  assert.match(f.run('status', '--config-dir', f.config).stdout, /installed/);
  assert.equal(f.run('install', '--config-dir', f.config).status, 0);
  assert.equal(f.run('uninstall', '--config-dir', f.config, '--dry-run').status, 0);
  assert.equal(f.run('uninstall', '--config-dir', f.config).status, 0);
  assert.equal(await fs.readFile(path.join(plugins, 'herdr-agent-state.js'), 'utf8'), '// foreign');
  assert.match(f.run('status', '--config-dir', f.config).stdout, /absent/);
});
test('unmanaged entry or helper refuses install and uninstall before any mutation', async t => {
  const f = await fixture(t);
  await fs.mkdir(path.dirname(f.entry), { recursive: true });
  await fs.writeFile(f.entry, '// foreign');
  for (const action of ['install', 'uninstall']) assert.equal(f.run(action, '--config-dir', f.config).status, 1);
  assert.match(f.run('install', '--config-dir', f.config).stderr, /unmanaged plugin file/);
  assert.equal(await fs.readFile(f.entry, 'utf8'), '// foreign');
  await fs.unlink(f.entry); assert.equal(f.run('install', '--config-dir', f.config).status, 0);
  const helper = path.join(f.config, 'plugins/yoroi/state.js');
  await fs.writeFile(helper, '// foreign helper');
  assert.equal(f.run('uninstall', '--config-dir', f.config).status, 1);
  assert.ok(await fs.stat(f.entry));
});
test('explicit temporary XDG path and unsafe symlink targets are refused', async t => {
  const f = await fixture(t);
  assert.equal(f.run('install', '--config-dir', path.join(f.env.XDG_CONFIG_HOME, 'opencode')).status, 0);
  assert.ok(await fs.stat(path.join(f.env.XDG_CONFIG_HOME, 'opencode/plugins/yoroi-zen-free.js')));
  await fs.mkdir(path.dirname(f.entry), { recursive: true });
  const victim = path.join(f.root, 'victim'); await fs.writeFile(victim, '// foreign');
  await fs.symlink(victim, f.entry);
  assert.equal(f.run('install', '--config-dir', f.config).status, 1);
  assert.equal(f.run('uninstall', '--config-dir', f.config).status, 1);
  assert.match(f.run('install', '--config-dir', f.config).stderr, /symlink plugin file/);
  assert.equal(await fs.readFile(victim, 'utf8'), '// foreign');
});
test('symlink config diagnosis and OPENCODE_CONFIG_DIR install path warning are specific', async t => {
  const f = await fixture(t); const real = path.join(f.root, 'real'); await fs.mkdir(real);
  const link = path.join(f.root, 'link'); await fs.symlink(real, link);
  assert.match(f.run('install', '--config-dir', link).stderr, /symlink directory/);
  const result = spawnSync(process.execPath, [script, 'install', '--config-dir', real], {
    env: { ...f.env, OPENCODE_CONFIG_DIR: real }, encoding: 'utf8' });
  assert.equal(result.status, 0); assert.ok(result.stdout.includes(path.join(real, 'plugins')));
  assert.match(result.stdout, /OPENCODE_CONFIG_DIR.*discovery directory/);
  await assert.rejects(fs.stat(path.join(f.env.XDG_CONFIG_HOME, 'opencode')));
});
test('runtime allows reports beyond SQLite busy wait and uses argv without shell or raw data', async t => {
  const f = await fixture(t); const log = path.join(f.root, 'argv.json');
  const bin = path.join(f.root, 'fake yoroi');
  await fs.writeFile(bin, `#!${process.execPath}\nsetTimeout(()=>require('fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2))),2200);\n`, { mode: 0o700 });
  const runtime = new URL('../integrations/opencode/yoroi/runtime.js', import.meta.url).href;
  const code = `const {report,loadFreeModels}=await import(${JSON.stringify(runtime)});` +
    `let ticked=false;setTimeout(()=>{ticked=true},20);if(!(await report(['--ok','--model','free']))||!ticked)process.exit(1);` +
    `if((await loadFreeModels()).size!==0)process.exit(2);`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...f.env, YOROI_BIN: bin }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(await fs.readFile(log, 'utf8')), ['zen-free', 'report', '--ok', '--model', 'free']);
});
test('entry exports one plugin; missing executable and hung child fail safely', async t => {
  const f = await fixture(t);
  const entry = await import(new URL('../integrations/opencode/yoroi-zen-free.js', import.meta.url).href);
  assert.deepEqual(Object.keys(entry), ['YoroiZenFreePlugin']);
  const bin = path.join(f.root, 'hung');
  await fs.writeFile(bin, `#!${process.execPath}\nprocess.on('SIGTERM',()=>{});setInterval(()=>{},1000);\n`, { mode: 0o700 });
  const runtime = new URL('../integrations/opencode/yoroi/runtime.js', import.meta.url).href;
  const code = `const {report}=await import(${JSON.stringify(runtime)});if(await report(['--ok']))process.exit(1);`;
  for (const executable of [path.join(f.root, 'missing'), bin]) {
    const started = performance.now();
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
      env: { ...f.env, YOROI_BIN: executable }, encoding: 'utf8', timeout: 10000 });
    if (executable === bin) assert.ok(performance.now() - started >= 5800);
    assert.equal(result.status, 0); assert.equal(result.stderr, '');
  }
});
