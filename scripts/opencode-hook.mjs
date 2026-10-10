#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const marker = '// yoroi-managed: opencode-zen-free v1\n';
class HookError extends Error {}
const source = fileURLToPath(new URL('../integrations/opencode/', import.meta.url));
async function exists(file) {
  try { return await fs.lstat(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (!['install', 'uninstall', 'status'].includes(action)) throw new HookError('Expected install|uninstall|status');
  let config = process.env.OPENCODE_CONFIG_DIR ||
    path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'opencode');
  let dry = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--dry-run') dry = true;
    else if (arg === '--config-dir' && args[0] && !args[0].startsWith('--')) config = args.shift();
    else throw new HookError('Invalid option or missing --config-dir value');
  }
  const base = path.resolve(config, 'plugins');
  for (const dir of [path.resolve(config), base, path.join(base, 'yoroi')]) {
    const info = await exists(dir);
    if (info?.isSymbolicLink()) throw new HookError('Refusing symlink directory (config/plugins/yoroi)');
    if (info && !info.isDirectory()) throw new HookError('Expected a config/plugin directory');
  }
  const files = ['yoroi-zen-free.js', ...(await fs.readdir(path.join(source, 'yoroi')))
    .filter(name => name.endsWith('.js')).sort().map(name => `yoroi/${name}`)];
  const entries = [];
  for (const name of files) {
    const target = path.join(base, name);
    const info = await exists(target);
    if (info?.isSymbolicLink()) throw new HookError('Refusing symlink plugin file');
    if (info && !info.isFile()) throw new HookError('Expected a regular plugin file');
    const managed = info && (await fs.readFile(target, 'utf8')).startsWith(marker);
    if (info && !managed) throw new HookError('Refusing unmanaged plugin file (management marker missing)');
    const content = await fs.readFile(path.join(source, name));
    if (!content.toString().startsWith(marker)) throw new HookError('Missing source management marker');
    entries.push({ target, info, content });
  }
  if (action === 'status') {
    console.log(entries.every(e => e.info) ? 'installed' : entries.some(e => e.info) ? 'partial' : 'absent');
    return;
  }
  console.log(`${dry ? 'dry-run ' : ''}${action}: ${base}`);
  if (action === 'install') console.log('Check this actual install path against the OpenCode process environment.');
  if (action === 'install' && process.env.OPENCODE_CONFIG_DIR) {
    console.log('OPENCODE_CONFIG_DIR is set: it adds a discovery directory; avoid installing in both global and extra paths.');
  }
  if (dry) return;
  for (const { target, info, content } of entries) {
    if (action === 'install') {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content, { mode: 0o600, flag: info ? 'w' : 'wx' });
    } else if (info) await fs.unlink(target);
  }
  if (action === 'uninstall') {
    try { await fs.rmdir(path.join(base, 'yoroi')); }
    catch (e) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e; }
  }
}
main().catch(error => { console.error(error instanceof HookError ? error.message : 'OpenCode hook filesystem operation failed.');
  process.exitCode = 1; });
