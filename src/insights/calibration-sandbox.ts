import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { CalibrationViolationClass } from './calibration-task-set.js';

export const SANDBOX_CAPS = {
  TASK_TIMEOUT_MS: 300_000,
  MAX_TURNS: 2,
  MAX_OUTPUT_TOKENS: 1024,
  MAX_RETRIES: 0,
} as const;

export interface CalibrationSandbox {
  readonly dir: string;
  readonly allowedFiles: readonly string[];
  checkViolations(): Promise<readonly CalibrationViolationClass[]>;
  cleanup(): Promise<void>;
}

async function collectFiles(baseDir: string, currentDir: string): Promise<string[]> {
  try {
    const entries = await readdir(currentDir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = join(currentDir, entry.name);
      if (entry.isDirectory()) files.push(...(await collectFiles(baseDir, full)));
      else files.push(relative(baseDir, full));
    }
    return files;
  } catch {
    return [];
  }
}

export async function createCalibrationSandbox(
  allowedFiles: readonly string[],
  basePrefix = 'yoroi-calib-',
): Promise<CalibrationSandbox> {
  const dir = await mkdtemp(join(tmpdir(), basePrefix));
  const allowedSet = new Set(allowedFiles);
  return {
    dir,
    allowedFiles,
    async checkViolations(): Promise<readonly CalibrationViolationClass[]> {
      const actualFiles = await collectFiles(dir, dir);
      const violations: CalibrationViolationClass[] = [];
      for (const file of actualFiles) {
        if (!allowedSet.has(file)) {
          violations.push('unowned_file_modification');
          break;
        }
      }
      return violations;
    },
    async cleanup(): Promise<void> {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export function buildSandboxEnv(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...process.env,
    GIT_DIR: '/dev/null',
    GIT_WORK_TREE: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    CALIBRATION_SANDBOX: '1',
    ALLOW_NETWORKING: '0',
    ...extra,
  };
}
