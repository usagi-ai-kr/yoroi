import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { resolveDataDir } from '../infra/sqlite/data-dir.js';

let generatedRoot: string | undefined;
let cleanupRegistered = false;
function testRoot(): string {
  if (process.env.YOROI_TEST_DATA_ROOT) return process.env.YOROI_TEST_DATA_ROOT;
  generatedRoot ??= mkdtempSync(join(tmpdir(), 'yoroi-test-data-'));
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    process.once('exit', () => { if (generatedRoot) rmSync(generatedRoot, { recursive: true, force: true }); });
  }
  return generatedRoot;
}
function isTemporary(path: string): boolean {
  const suffix = relative(resolve(tmpdir()), resolve(path));
  return suffix === '' || (suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix));
}
function isCucumberRun(): boolean {
  return process.argv.some(arg => arg.includes('/@cucumber/cucumber/') ||
    /(?:^|[\\/])cucumber(?:\.js)?$/.test(arg));
}

/** Data configuration is independent of the provider-only configEnv often injected in tests. */
export function dataEnvironment(configEnv?: Readonly<Record<string, string | undefined>>,
  dataDir?: string): NodeJS.ProcessEnv {
  const env = { ...process.env, ...configEnv, ...(dataDir !== undefined && { YOROI_DATA_DIR: dataDir }) };
  const harnessRoot = process.env.YOROI_TEST_DATA_ROOT;
  if (!process.env.NODE_TEST_CONTEXT && !harnessRoot && !isCucumberRun()) return env;
  const explicit = dataDir !== undefined || configEnv?.YOROI_DATA_DIR !== undefined;
  if (!isTemporary(resolveDataDir(env))) {
    if (explicit || harnessRoot) throw new Error('Tests must use a temporary data directory');
    env.YOROI_DATA_DIR = join(testRoot(), 'data');
  }
  if (!isTemporary(resolveDataDir(env))) throw new Error('Tests must use a temporary data directory');
  return env;
}
