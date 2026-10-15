import { providers, type ProviderId } from '../domain/usage.js';

export interface ProviderSettings {
  readonly id: ProviderId;
  readonly executable: string;
  readonly timeoutMs: number;
  readonly apiKey?: string;
  readonly signingKeyPath?: string;
  readonly oauthToken?: string;
  readonly configDir?: string;
  readonly secureStorageConfigDir?: string;
  readonly home?: string;
}
export interface RuntimeConfig {
  readonly providers: readonly ProviderSettings[];
}
function positive(value: string | undefined, fallback: number, name: string, maximum = 86400000): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 ||
    Number(value) > maximum) throw new Error(`Invalid ${name}`);
  return Number(value);
}
export function loadConfig(env: Readonly<Record<string, string | undefined>>): RuntimeConfig {
  const selected = env.YOROI_PROVIDERS !== undefined
    ? env.YOROI_PROVIDERS.split(',').map(value => value.trim())
    : [...providers];
  if (selected.length === 0 || new Set(selected).size !== selected.length ||
    selected.some(id => !providers.includes(id as ProviderId))) {
    throw new Error('Invalid provider selection');
  }
  const timeoutMs = positive(env.YOROI_TIMEOUT_MS, 10000, 'timeout');
  const settings = selected.map(value => {
    const id = value as ProviderId;
    const prefix = `YOROI_${id.toUpperCase().replaceAll('-', '_')}`;
    const executable = env[`${prefix}_PATH`] ?? (id === 'xai' ? 'opencode' : id);
    if (!executable.trim()) throw new Error('Invalid CLI executable path');
    const setting: ProviderSettings = {
      id, executable, timeoutMs: positive(env[`${prefix}_TIMEOUT_MS`], timeoutMs, 'provider timeout'),
    };
    if (id === 'claude') {
      const oauthToken = env.YOROI_CLAUDE_OAUTH_TOKEN ?? env.CLAUDE_CODE_OAUTH_TOKEN;
      return { ...setting,
        ...(oauthToken !== undefined ? { oauthToken } : {}),
        ...(env.CLAUDE_CONFIG_DIR !== undefined ? { configDir: env.CLAUDE_CONFIG_DIR } : {}),
        ...(env.CLAUDE_SECURESTORAGE_CONFIG_DIR !== undefined
          ? { secureStorageConfigDir: env.CLAUDE_SECURESTORAGE_CONFIG_DIR } : {}),
        ...(env.HOME !== undefined ? { home: env.HOME } : {}),
      };
    }
    if (id === 'ollama-pro') {
      const rawPath = env.YOROI_OLLAMA_PRO_SIGNING_KEY_PATH ??
        (env.HOME ? `${env.HOME}/.ollama/id_ed25519` : undefined);
      const signingKeyPath = rawPath?.trim();
      return signingKeyPath ? { ...setting, signingKeyPath } : setting;
    }
    if (id === 'opencode-go') {
      const apiKey = env[`${prefix}_API_KEY`]?.trim();
      return apiKey ? { ...setting, apiKey } : setting;
    }
    return setting;
  });
  return { providers: settings };
}
/** OpenCode 대상 버전(p42): YOROI_OPENCODE_TARGET=v1|v2, 기본 v1. 그 밖의 값은 다른 설정처럼 거부한다. */
export function opencodeTarget(env: Readonly<Record<string, string | undefined>>): 'v1' | 'v2' { const value = env.YOROI_OPENCODE_TARGET?.trim() || 'v1'; if (value !== 'v1' && value !== 'v2') throw new Error('Invalid opencode target'); return value; }
