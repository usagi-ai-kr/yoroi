export interface ModelDiscoveryConfig {
  readonly enabled: boolean;
  readonly providers?: readonly string[];
  readonly baseDir?: string;
  readonly excluded?: readonly string[];
}

export const DEFAULT_MODEL_DISCOVERY_CONFIG: ModelDiscoveryConfig = {
  enabled: false,
};

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
  const providers = strList(discovery.providers ?? discovery.sources);
  const excluded = strList(discovery.excluded);
  const baseDir = typeof discovery.baseDir === 'string' && discovery.baseDir.trim().length > 0 ? discovery.baseDir.trim() : undefined;
  return {
    enabled,
    ...(providers.length > 0 ? { providers } : {}),
    ...(excluded.length > 0 ? { excluded } : {}),
    ...(baseDir !== undefined ? { baseDir } : {}),
  };
}
