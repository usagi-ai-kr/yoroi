export interface ModelDiscoveryConfig {
  readonly enabled: boolean;
  readonly providers?: readonly string[];
  readonly baseDir?: string;
  readonly excluded?: readonly string[];
  /** Q1: 자동 편입 금지(기본 false). 러너는 이 값을 읽지 않는다(호출자 계약). */
  readonly autoEnroll?: boolean;
  /** Q2: 제거는 diff 표기만. 유일한 값이다. */
  readonly deprecation?: 'diff-only';
}

import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const DEFAULT_MODEL_DISCOVERY_CONFIG: ModelDiscoveryConfig = {
  enabled: false,
  autoEnroll: false,
  deprecation: 'diff-only',
};

/** Q4: 키 없이 쓸 수 있는 공개/CLI 제공자만. API 키 제공자는 넣지 않는다. */
export const RECOMMENDED_DISCOVERY_PROVIDERS: readonly string[] = ['opencode', 'openrouter', 'ollama'];

const strList = (val: unknown): string[] =>
  Array.isArray(val) ? val.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : [];

export function loadModelDiscoveryConfig(raw?: unknown): ModelDiscoveryConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return DEFAULT_MODEL_DISCOVERY_CONFIG;
  }
  const record = raw as Record<string, unknown>;
  const discovery = typeof record.discovery === 'object' && record.discovery !== null && !Array.isArray(record.discovery)
    ? record.discovery as Record<string, unknown>
    : record;
  const enabled = discovery.enabled === true;
  const hasProviders = Array.isArray(discovery.providers) || Array.isArray(discovery.sources);
  const providers = strList(discovery.providers ?? discovery.sources);
  const excluded = strList(discovery.excluded);
  const autoEnroll = discovery.autoEnroll === true;
  const baseDir = typeof discovery.baseDir === 'string' && discovery.baseDir.trim().length > 0 ? discovery.baseDir.trim() : undefined;
  return {
    enabled,
    autoEnroll,
    deprecation: 'diff-only',
    ...(hasProviders ? { providers } : enabled ? { providers: [...RECOMMENDED_DISCOVERY_PROVIDERS] } : {}),
    ...(excluded.length > 0 ? { excluded } : {}),
    ...(baseDir !== undefined ? { baseDir } : {}),
  };
}

/** Q3: 스냅샷 baseDir 결정. XDG 우선, home 주입, 명시 override 최우선. */
export function resolveDiscoveryBaseDir(options?: {
  readonly env?: NodeJS.ProcessEnv; readonly home?: string; readonly override?: string;
}): string {
  const override = options?.override?.trim();
  if (override) return override;
  const env = options?.env ?? process.env;
  const xdg = env.XDG_CONFIG_HOME?.trim();
  if (xdg && isAbsolute(xdg)) return join(xdg, 'yoroi', 'discovery');
  const home = options?.home ?? env.HOME?.trim() ?? homedir();
  return join(home, '.config', 'yoroi', 'discovery');
}
