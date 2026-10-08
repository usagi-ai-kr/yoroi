#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const repoEnvPath = path.join(repoRoot, '.env');

function findInstalledPath() {
  try {
    const listOut = execSync('pnpm list -g --json', { encoding: 'utf8' });
    const parsed = JSON.parse(listOut);
    const p = parsed[0]?.dependencies?.['yoroi']?.path;
    if (p && fs.existsSync(p)) return p;
  } catch {}
  try {
    const root = execSync('pnpm root -g', { encoding: 'utf8' }).trim();
    const candidate = path.join(root, 'node_modules', 'yoroi');
    if (fs.existsSync(candidate)) return candidate;
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        const sub = path.join(root, ent.name, 'node_modules', 'yoroi');
        if (fs.existsSync(sub)) return sub;
      }
    }
  } catch {}
  return null;
}

function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yoroi-pack-'));
  try {
    execSync(`pnpm pack --pack-destination "${tmpDir}"`, {
      cwd: repoRoot,
      stdio: 'inherit',
    });
    const tarballs = fs.readdirSync(tmpDir).filter((f) => f.endsWith('.tgz'));
    if (tarballs.length === 0) {
      throw new Error('Tarball not created');
    }
    const tarballPath = path.join(tmpDir, tarballs[0]);
    execSync(`pnpm add -g "${tarballPath}"`, {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const installedPath = findInstalledPath();
  if (!installedPath) {
    console.error('Failed to locate installed yoroi package');
    process.exit(1);
  }

  const repoRealPath = fs.realpathSync(repoRoot);
  const installedRealPath = fs.realpathSync(installedPath);
  if (repoRealPath === installedRealPath) {
    console.error('Error: installed package realpath is inside repository');
    process.exit(1);
  }

  console.log(`Installed path: ${installedPath}`);
  console.log(`Installed realpath: ${installedRealPath}`);

  if (fs.existsSync(repoEnvPath)) {
    const targetEnvPath = path.join(installedRealPath, '.env');
    fs.copyFileSync(repoEnvPath, targetEnvPath);
    fs.chmodSync(targetEnvPath, 0o600);
    console.log(`Copied .env to: ${targetEnvPath} (chmod 600)`);
  }
}

main();
