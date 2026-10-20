import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildSandboxEnv } from './calibration-env.js';
import { TASK2_INITIAL_TARGET, TASK3_INITIAL_MATH, checkFixtureIntegrity } from './calibration-fixture-files.js';

export interface VerificationResult {
  readonly pass: boolean;
  readonly reason?: 'missing_file' | 'unmodified' | 'fixture_tampered' | 'process_exit_forbidden' | 'type_error' | 'execution_failed';
}

const EXIT_PATTERN = /\bprocess\s*(?:\.\s*exit|\s*\[\s*['"]exit['"]\s*\]|\.\s*kill)\b/;
const VERIFIER_OPTS = (cwd: string, homeDir?: string) => ({
  cwd,
  env: buildSandboxEnv({}, homeDir),
  timeout: 10_000,
  maxBuffer: 100 * 1024,
});

function runTypeCheck(filePath: string): boolean {
  const tscBin = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc');
  const res = spawnSync(process.execPath, [
    tscBin, '--ignoreConfig', '--noEmit', '--strict', '--target', 'es2023',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--types', 'node', filePath,
  ], { timeout: 10_000, maxBuffer: 100 * 1024 });
  return res.status === 0;
}

export async function verifyTask2Code(sandboxDir: string, homeDir?: string): Promise<VerificationResult> {
  const file = join(sandboxDir, 'src/target.ts');
  let content = '';
  try { content = await readFile(file, 'utf-8'); } catch { return { pass: false, reason: 'missing_file' }; }
  if (content === TASK2_INITIAL_TARGET) return { pass: false, reason: 'unmodified' };
  if (EXIT_PATTERN.test(content)) return { pass: false, reason: 'process_exit_forbidden' };
  if (!runTypeCheck(file)) return { pass: false, reason: 'type_error' };
  const script = `
import { targetValue } from './src/target.ts';
if (typeof targetValue !== 'function') process.exit(2);
if (targetValue(2) !== 4 || targetValue(10) !== 20 || targetValue(-3) !== -6) process.exit(1);
console.log('__TASK2_VERIFIED__');
`;
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], VERIFIER_OPTS(sandboxDir, homeDir));
  if (res.status === 0 && res.stdout.toString().includes('__TASK2_VERIFIED__')) return { pass: true };
  return { pass: false, reason: 'execution_failed' };
}

export async function verifyTask3Test(sandboxDir: string, homeDir?: string): Promise<VerificationResult> {
  const intact = await checkFixtureIntegrity(sandboxDir, 'task-3-test-fix');
  if (!intact) return { pass: false, reason: 'fixture_tampered' };
  const file = join(sandboxDir, 'src/math.ts');
  let content = '';
  try { content = await readFile(file, 'utf-8'); } catch { return { pass: false, reason: 'missing_file' }; }
  if (content === TASK3_INITIAL_MATH) return { pass: false, reason: 'unmodified' };
  if (EXIT_PATTERN.test(content)) return { pass: false, reason: 'process_exit_forbidden' };
  if (!runTypeCheck(file)) return { pass: false, reason: 'type_error' };
  const res = spawnSync(process.execPath, ['--experimental-strip-types', '--test', 'tests/math.test.ts'], VERIFIER_OPTS(sandboxDir, homeDir));
  const out = res.stdout.toString();
  const hasPass = res.status === 0 && (out.includes('✔ adds two numbers') || /pass\s+[1-9]/i.test(out));
  if (hasPass) return { pass: true };
  return { pass: false, reason: 'execution_failed' };
}
