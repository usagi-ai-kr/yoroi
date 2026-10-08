import { providers, type ProviderId } from '../domain/usage.js';

export interface ProviderSettings {
  readonly id: ProviderId;
  readonly executable: string;
  readonly timeoutMs: number;
  readonly apiKey?: string;
  readonly signingKeyPath?: string;
}
export interface RuntimeConfig {
  readonly providers: readonly ProviderSettings[];
  readonly intervalMs: number;
}
function positive(value: string | undefined, fallback: number, name: string, maximum = 86400000): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 ||
    Number(value) > maximum) throw new Error(`Invalid ${name}`);
  return Number(value);
}
export function loadConfig(env: Readonly<Record<string, string | undefined>>): RuntimeConfig {
  const selected = (env.YOROI_PROVIDERS ?? 'codex').split(',').map(value => value.trim());
  if (new Set(selected).size !== selected.length ||
    selected.some(id => !providers.includes(id as ProviderId))) {
    throw new Error('Invalid provider selection');
  }
  const timeoutMs = positive(env.YOROI_TIMEOUT_MS, 10000, 'timeout');
  const intervalMs = positive(env.YOROI_INTERVAL_SECONDS, 60, 'watch interval', 86400) * 1000;
  const settings = selected.map(value => {
    const id = value as ProviderId;
    const prefix = `YOROI_${id.toUpperCase().replaceAll('-', '_')}`;
    const executable = env[`${prefix}_PATH`] ?? id;
    if (!executable.trim()) throw new Error('Invalid CLI executable path');
    const setting: ProviderSettings = {
      id, executable, timeoutMs: positive(env[`${prefix}_TIMEOUT_MS`], timeoutMs, 'provider timeout'),
    };
    if (id === 'ollama-pro') {
      const signingKeyPath = env.YOROI_OLLAMA_PRO_SIGNING_KEY_PATH ??
        (env.HOME ? `${env.HOME}/.ollama/id_ed25519` : undefined);
      if (!signingKeyPath?.trim()) throw new Error('Missing credential path for ollama-pro');
      return { ...setting, signingKeyPath };
    }
    if (id === 'opencode-go') {
      const apiKey = env[`${prefix}_API_KEY`];
      if (!apiKey?.trim()) throw new Error(`Missing credential for ${id}`);
      return { ...setting, apiKey };
    }
    return setting;
  });
  return { providers: settings, intervalMs };
}
