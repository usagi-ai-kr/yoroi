import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { packageRootFrom } from './env-file.js';

export interface ReviewerDimensionWeights {
  readonly performance: number;
  readonly speed: number;
  readonly price: number;
}

export interface ReviewerPolicyConfigData {
  readonly weights: ReviewerDimensionWeights;
  readonly status: 'confirmed';
  readonly confirmed: true;
}

export const REVIEWER_DIMENSIONS = ['performance', 'speed', 'price'] as const;
export const REVIEWER_POLICY_ENV = 'YOROI_REVIEWER_POLICY_PATH';
export const BUNDLED_REVIEWER_POLICY_PATH = resolve(packageRootFrom(import.meta.url), 'config/reviewer-policy.json');

function invalid(detail: string): never {
  throw new Error(`Invalid reviewer policy: ${detail}`);
}

export function validateReviewerWeights(raw: unknown): ReviewerDimensionWeights {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) invalid('root must be an object');
  const source = raw as Record<string, unknown>;
  const candidate = (source.weights ?? source.reviewer ?? source) as Record<string, unknown>;
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) invalid('weights must be an object');
  for (const k of Object.keys(candidate)) {
    if (!REVIEWER_DIMENSIONS.includes(k as typeof REVIEWER_DIMENSIONS[number])) invalid(`unknown dimension '${k}'`);
  }
  const result = {} as Record<typeof REVIEWER_DIMENSIONS[number], number>;
  let sum = 0;
  for (const dim of REVIEWER_DIMENSIONS) {
    const val = candidate[dim];
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
      invalid(`dimension '${dim}' must be a finite number >= 0`);
    }
    result[dim] = val;
    sum += val;
  }
  if (sum === 0) invalid('all weights cannot be zero');
  if (Math.abs(sum - 1) > 1e-6) invalid(`weights must sum to 1.0 (got ${sum})`);
  return result;
}

export function resolveReviewerPolicyPath(options?: {
  readonly explicitPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly home?: string;
}): string {
  const explicit = options?.explicitPath?.trim();
  if (explicit) return explicit;
  const env = options?.env ?? process.env;
  const envPath = env[REVIEWER_POLICY_ENV]?.trim();
  if (envPath) return envPath;
  const xdg = env.XDG_CONFIG_HOME?.trim();
  const base = xdg && isAbsolute(xdg) ? xdg : join(options?.home ?? env.HOME?.trim() ?? homedir(), '.config');
  const xdgPath = join(base, 'yoroi', 'reviewer-policy.json');
  if (existsSync(xdgPath)) return xdgPath;
  return BUNDLED_REVIEWER_POLICY_PATH;
}

export function loadReviewerPolicy(options?: string | {
  readonly explicitPath?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly home?: string;
}): ReviewerPolicyConfigData {
  const opts = typeof options === 'string' ? { explicitPath: options } : options;
  const targetPath = resolveReviewerPolicyPath(opts);
  if (!existsSync(targetPath)) invalid(`configuration file not found at ${targetPath}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(targetPath, 'utf8'));
  } catch (e) {
    invalid(`malformed JSON at ${targetPath}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const weights = validateReviewerWeights(parsed);
  return { weights, status: 'confirmed', confirmed: true };
}

export const REVIEWER_POLICY: ReviewerPolicyConfigData = loadReviewerPolicy();
export const REVIEWER_WEIGHTS: ReviewerDimensionWeights = REVIEWER_POLICY.weights;
