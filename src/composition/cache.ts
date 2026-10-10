import { createHash } from 'node:crypto';
import type { ProviderSettings, RuntimeConfig } from '../config/load-config.js';
import { CachedSource } from '../app/cached-source.js';
import type { UsageCache, UsageClock } from '../app/usage-cache-port.js';
import type { UsageHistory } from '../app/usage-history-port.js';
import type { UsageSourceIdentity } from '../app/usage-result-meta.js';
import type { UsageSource } from '../app/usage-source.js';
import { resolveDbPath } from '../infra/sqlite/data-dir.js';
import { openUsageDatabase, SqliteUsageCache } from '../infra/sqlite/usage-cache-store.js';
import { SqliteUsageHistory } from '../infra/sqlite/usage-history-store.js';

export interface UsagePersistence {
  readonly cache: UsageCache;
  readonly history: UsageHistory;
  close(): void;
}
const CONTRACTS = { claude: 'v1', codex: 'v1', agy: 'v1', 'ollama-pro': 'v1', 'opencode-go': 'v1' } as const;
/** Credential values contribute only via one-way SHA-256 digest; raw secrets never enter scope/log/DB. */
function accountHash(value: string | undefined, absent: string): string {
  if (value === undefined) return absent;
  return `cred-${createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16)}`;
}
export function sourceIdentity(settings: ProviderSettings,
  env: Readonly<Record<string, string | undefined>>): UsageSourceIdentity {
  const prefix = `YOROI_${settings.id.toUpperCase().replaceAll('-', '_')}`;
  const material = [settings.id, settings.executable, settings.home ?? env.HOME ?? '',
    settings.configDir ?? '', settings.secureStorageConfigDir ?? '', settings.signingKeyPath ?? '',
    settings.id === 'claude' ? accountHash(settings.oauthToken, 'oauth-store') : '',
    settings.id === 'opencode-go' ? accountHash(settings.apiKey, 'api-unset') : '',
    env[`${prefix}_PROFILE`] ?? '',
    settings.id === 'codex' ? env.CODEX_HOME ?? '' : '',
    settings.id === 'agy' ? env.AGY_CONFIG_DIR ?? '' : ''];
  return { scope: createHash('sha256').update(JSON.stringify(material)).digest('hex').slice(0, 24),
    contractVersion: CONTRACTS[settings.id] };
}
/** once creates its persistent cache on first use; composition isolates creation/opening errors. */
export function openUsagePersistence(env: NodeJS.ProcessEnv): UsagePersistence {
  const db = openUsageDatabase(resolveDbPath(env));
  return { cache: new SqliteUsageCache(db), history: new SqliteUsageHistory(db), close: () => db.close() };
}
export function cacheSources(sources: readonly UsageSource[], config: RuntimeConfig,
  env: Readonly<Record<string, string | undefined>>, persistence: UsagePersistence,
  refresh: boolean, clock?: UsageClock): readonly CachedSource[] {
  return sources.map((source, index) => new CachedSource(source, {
    cache: persistence.cache, history: persistence.history, refresh, ...(clock && { clock }),
    key: { provider: source.provider, lookup: 'windows:all', ...sourceIdentity(config.providers[index]!, env) },
  }));
}
