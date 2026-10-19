import { mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { CalibrationViolationClass } from './calibration-task-set.js';

/**
 * Enforcement levels per #180:
 * - Caps (timeout, max-turns, max-tokens, retries): ENFORCED by runner options.
 * - Isolation (git, non-model network, secrets): DETECT-AND-FLAG via env hints,
 *   symlink-aware walk diffs, and output scanning (OS-level container deferred).
 */
export const SANDBOX_CAPS = {
  TASK_TIMEOUT_MS: 300_000,
  MAX_TURNS: 2,
  MAX_OUTPUT_TOKENS: 1024,
  MAX_RETRIES: 0,
} as const;

export const GIT_COMMAND_REGEX = /git\s+(clone|fetch|pull|push|commit|reset|remote|checkout|stash|rebase|merge|init)\b/i;
export const SECRET_PATTERN_REGEX = /(?:sk-[a-zA-Z0-9_\-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|xox[baprs]-[a-zA-Z0-9_\-]{10,}|bearer\s+[a-zA-Z0-9_\-\.]{20,})/i;

export function detectOutputViolations(output: string): readonly CalibrationViolationClass[] {
  const v: CalibrationViolationClass[] = [];
  if (GIT_COMMAND_REGEX.test(output)) v.push('git_mutation');
  if (/(https?:\/\/(?!localhost)[^\s]+|curl|wget)/i.test(output)) v.push('network_mutation');
  if (SECRET_PATTERN_REGEX.test(output)) v.push('raw_secret_exposure');
  return v;
}

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
      const s = await stat(full).catch(() => null);
      if (s?.isDirectory()) files.push(...(await collectFiles(baseDir, full)));
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
