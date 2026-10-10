#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const versionPattern = /^(?:yoroi\s+)?v?(\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?)$/;
/** Only fixed diagnostics and validated versions are emitted, never child output. */
export function updateGlobal({ args = [], root = repoRoot,
  version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version,
  run = (command, argv) => spawnSync(command, argv, { cwd: root, encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 }),
  write = message => console.log(message),
} = {}) {
  if (args.some(arg => !['--check', '--strict', '--help'].includes(arg))) {
    write('Usage: pnpm run update:global [--check] [--strict]'); return 2;
  }
  if (args.includes('--help')) {
    write('Usage: pnpm run update:global [--check] [--strict]'); return 0;
  }
  if (typeof version !== 'string' || !versionPattern.test(version)) {
    write('Invalid repository version'); return 2;
  }
  const execute = (command, argv) => {
    try { return run(command, argv); } catch { return { status: null }; }
  };
  const compare = (afterInstall = false) => {
    const result = execute('yoroi', ['--version']);
    const installed = result.status === 0 && !result.error && typeof result.stdout === 'string'
      ? versionPattern.exec(result.stdout.trim())?.[1] : undefined;
    if (!installed) {
      write('Global yoroi is unavailable or its version could not be verified');
      return afterInstall ? 1 : 2;
    }
    write(`repository=${version} global=${installed}`);
    return installed === version ? 0 : 1;
  };
  // Check performs only version reads: no build, install, Git or .env access.
  if (args.includes('--check')) return compare();
  let warned = false;
  const status = execute('git', ['status', '--porcelain']);
  if (status.status !== 0 || status.error || typeof status.stdout !== 'string') {
    write('Warning: working tree status could not be checked'); warned = true;
  } else if (status.stdout.trim()) {
    write('Warning: working tree has uncommitted changes'); warned = true;
  }
  const behind = execute('git', ['rev-list', '--count', 'HEAD..origin/main']);
  if (behind.status !== 0 || behind.error || !/^\d+\s*$/.test(behind.stdout ?? '')) {
    write('Warning: origin/main comparison is unavailable'); warned = true;
  } else if (Number(behind.stdout.trim()) > 0) {
    write('Warning: working tree is behind local origin/main'); warned = true;
  }
  if (warned && args.includes('--strict')) {
    write('Strict update refused'); return 1;
  }
  // Reuse the existing tarball installer and its .env copying policy unchanged.
  for (const script of ['build', 'install:global']) {
    const result = execute('pnpm', ['run', script]);
    if (result.status !== 0 || result.error) {
      write(`Global update failed during ${script}`); return 1;
    }
  }
  return compare(true);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = updateGlobal({ args: process.argv.slice(2) }); }
  catch { console.error('Global update failed'); process.exitCode = 1; }
}
