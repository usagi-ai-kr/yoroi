import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { claudeCredentialPath } from '../infra/claude-credential-source.js';
import { claudePrincipal, digest } from '../infra/claude-principal.js';
import type { ProviderSettings, RuntimeConfig } from '../config/load-config.js';
import { CachedSource } from '../app/cached-source.js';
import { hasPrincipal } from '../app/claude-scope.js';
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
function accountHash(value: string | undefined, absent: string): string {
  return value === undefined ? absent : digest('cred', value);
}
/** Same directory resolution as claude-credentials.ts; unreadable files fall back to path-only scope. */
function claudeStoreDigest(settings: ProviderSettings, env: Readonly<Record<string, string | undefined>>, platform: string): string {
  const home = settings.home ?? env.HOME;
  const path = claudeCredentialPath({ ...settings, ...(home !== undefined ? { home } : {}), platform });
  if (!path) return 'oauth-store';
  try { return claudePrincipal(readFileSync(path, 'utf8')) ?? 'oauth-store'; }
  catch { return 'oauth-store'; }
}
function ollamaKeyDigest(path: string | undefined): string {
  if (path === undefined) return '';
  try { return digest('key', readFileSync(path)); } catch { return 'key-unreadable'; }
}
/** Scope policy: env credential digest wins (mirrors auth precedence); else file-backed digest with
 * per-user account id preferred so token refresh keeps history, token digest otherwise (refresh rotates
 * scope by design: isolation beats continuity). Keychain bytes are never read here: when the credential
 * is Keychain-first (darwin, no env token) `deferred` leaves the account out and cacheSources appends it
 * from the single authentication read (CachedSource `principal`). */
export function sourceIdentity(settings: ProviderSettings,
  env: Readonly<Record<string, string | undefined>>, platform: string = process.platform,
  deferred = false): UsageSourceIdentity {
  const prefix = `YOROI_${settings.id.toUpperCase().replaceAll('-', '_')}`;
  const material = [settings.id, settings.executable, settings.home ?? env.HOME ?? '',
    settings.configDir ?? '', settings.secureStorageConfigDir ?? '', settings.signingKeyPath ?? '',
    settings.id === 'ollama-pro' ? ollamaKeyDigest(settings.signingKeyPath) : '',
    settings.id === 'claude' ? (deferred ? 'principal-deferred' : settings.oauthToken === undefined ? claudeStoreDigest(settings, env, platform) : accountHash(settings.oauthToken, 'oauth-store')) : '',
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
  refresh: boolean, clock?: UsageClock, platform: string = process.platform): readonly CachedSource[] {
  return sources.map((source, index) => {
    const settings = config.providers[index]!;
    const keychainFirst = settings.id === 'claude' && settings.oauthToken === undefined && platform === 'darwin';
    const principal = keychainFirst && hasPrincipal(source) ? source.principal : undefined;
    return new CachedSource(source, {
      cache: persistence.cache, history: persistence.history, refresh, ...(clock && { clock }),
      ...(principal && { principal }),
      key: { provider: source.provider, lookup: 'windows:all', ...sourceIdentity(settings, env, platform, principal !== undefined) },
    });
  });
}
