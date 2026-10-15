#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const managedVersion = text => /^\/\/ yoroi-managed: opencode-zen-free (v\d+)\r?\n/.exec(text)?.[1];
const sources = { v1: '../integrations/opencode/', v2: '../integrations/opencode-v2/' };
class HookError extends Error {}
async function exists(file) {
  try { return await fs.lstat(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function main() {
  const [action, ...args] = process.argv.slice(2);
  if (!['install', 'uninstall', 'status'].includes(action)) throw new HookError('Expected install|uninstall|status');
  let config = process.env.OPENCODE_CONFIG_DIR ||
    path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'opencode');
  let dry = false, force = false, target = 'v1';
  while (args.length) {
    const arg = args.shift();
    if (arg === '--dry-run') dry = true;
    else if (arg === '--force') force = true;
    else if (['--config-dir', '--target'].includes(arg) && args[0] && !args[0].startsWith('--')) {
      const value = args.shift(); if (arg === '--target') target = value; else config = value;
    } else throw new HookError('Invalid option or missing option value');
  }
  if (!Object.hasOwn(sources, target)) throw new HookError('Expected --target v1|v2');
  const base = path.resolve(config, 'plugins'), helperDir = path.join(base, 'yoroi');
  for (const dir of [path.resolve(config), base, helperDir]) {
    const info = await exists(dir);
    if (info?.isSymbolicLink()) throw new HookError('Refusing symlink directory (config/plugins/yoroi)');
    if (info && !info.isDirectory()) throw new HookError('Expected a config/plugin directory');
  }
  const source = fileURLToPath(new URL(sources[target], import.meta.url));
  const entry = 'yoroi-zen-free.js';
  const helpers = async dir => (await exists(dir) ? await fs.readdir(dir) : [])
    .filter(name => name.endsWith('.js')).sort().map(name => `yoroi/${name}`);
  const wanted = [entry, ...(await helpers(path.join(source, 'yoroi')))]; // v2도 yoroi/ 헬퍼를 함께 복사
  const helpersAt = t => helpers(fileURLToPath(new URL(`${sources[t]}yoroi/`, import.meta.url)));
  const expectedV1 = await helpersAt('v1');
  const expectedV2 = await helpersAt('v2');
  const names = [...new Set([...wanted, ...(action === 'status' ? expectedV1 : []), ...await helpers(helperDir)])];
  const entries = [];
  for (const name of names) {
    const file = path.join(base, name), info = await exists(file);
    if (info?.isSymbolicLink()) throw new HookError('Refusing symlink plugin file');
    if (info && !info.isFile()) throw new HookError('Expected a regular plugin file');
    const version = info && managedVersion(await fs.readFile(file, 'utf8'));
    if (info && !version) throw new HookError('Refusing unmanaged plugin file (management marker missing)');
    if (action === 'install' && version && version !== target && !force)
      throw new HookError('Refusing different target marker; use --force to replace');
    let content;
    if (action === 'install' && wanted.includes(name)) {
      content = await fs.readFile(path.join(source, name));
      if (managedVersion(content.toString()) !== target) throw new HookError('Missing source management marker');
    }
    entries.push({ file, info, version, content, name });
  }
  if (action === 'status') {
    const installed = entries.find(e => e.name === entry)?.version;
    const present = entries.filter(e => e.info);
    // 출처의 해당 target 헬퍼가 모두 설치돼 있고 설치된 관리 파일이 전부 같은 마커여야 complete.
    // (v2는 entry+yoroi/signals.js 다중파일. 출처 삭제 시 헬퍼 집합이 비어 entry만으로 판정)
    const has = (list, v) => list.every(n => present.some(e => e.name === n && e.version === v));
    const complete = installed === 'v2'
      ? has(expectedV2, 'v2') && present.every(e => e.version === 'v2')
      : installed === 'v1' && has(expectedV1, 'v1') && present.every(e => e.version === 'v1');
    console.log(`${complete ? 'installed' : entries.some(e => e.info) ? 'partial' : 'absent'}${installed ? ` target=${installed}` : ''}`);
    return;
  }
  console.log(`${dry ? 'dry-run ' : ''}${action}: ${base} target=${target}`);
  if (action === 'install') console.log('Check this actual install path against the OpenCode process environment.');
  if (action === 'install' && process.env.OPENCODE_CONFIG_DIR)
    console.log('OPENCODE_CONFIG_DIR is set: it adds a discovery directory; avoid installing in both global and extra paths.');
  if (dry) return;
  for (const { file, info, content } of entries) {
    if (action === 'install' && content) {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content, { mode: 0o600, flag: info ? 'w' : 'wx' });
    } else if (info) await fs.unlink(file);
  }
  if (action === 'uninstall' || target === 'v2') {
    try { await fs.rmdir(helperDir); }
    catch (e) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(e.code)) throw e; }
  }
}
main().catch(error => { console.error(error instanceof HookError ? error.message : 'OpenCode hook filesystem operation failed.');
  process.exitCode = 1; });
