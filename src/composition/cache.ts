import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
/** Credential bytes contribute only via one-way SHA-256 digest; raw secrets never enter scope/log/DB. */
function digest(tag: string, raw: string | Buffer): string {
  return `${tag}-${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}
function accountHash(value: string | undefined, absent: string): string {
  return value === undefined ? absent : digest('cred', value);
}
/** Best-effort stable account id from a Claude .credentials.json dump; else the token digest. */
function stableClaudeId(content: string): string | undefined {
  try {
    const data = JSON.parse(content) as Record<string, unknown>;
    const oauth = (data.claudeAiOauth ?? {}) as Record<string, unknown>;
    for (const c of [data.email, data.accountId, data.userId, data.account_id, data.user_id, oauth.email, oauth.accountId, oauth.userId, oauth.subscriptionId, oauth.organizationId]) {
      if (typeof c === 'string' && c.trim()) return digest('stable', c.trim());
    }
    const token = oauth.accessToken;
    return typeof token === 'string' && token.trim() ? digest('cred', token.trim()) : undefined;
  } catch { return undefined; }
}
/** Same directory resolution as claude-credentials.ts; unreadable files fall back to path-only scope. */
function claudeStoreDigest(settings: ProviderSettings, env: Readonly<Record<string, string | undefined>>): string {
  const home = settings.home ?? env.HOME;
  const dir = settings.secureStorageConfigDir ?? settings.configDir ?? (home?.trim() ? join(home, '.claude') : undefined);
  if (!dir?.trim()) return 'oauth-store';
  try { return stableClaudeId(readFileSync(join(dir, '.credentials.json'), 'utf8')) ?? 'oauth-store'; }
  catch { return 'oauth-store'; }
}
function ollamaKeyDigest(path: string | undefined): string {
  if (path === undefined) return '';
  try { return digest('key', readFileSync(path)); } catch { return 'key-unreadable'; }
}
/** Scope policy: env credential digest wins (mirrors auth precedence); else file-backed digest with
 * stable account id preferred so token refresh keeps history, token digest otherwise (refresh rotates
 * scope by design: isolation beats continuity). Keychain bytes are never read here, so a Keychain-only
 * rotation on identical paths is NOT isolated: use an env token or <PROVIDER>_PROFILE for that case. */
export function sourceIdentity(settings: ProviderSettings,
  env: Readonly<Record<string, string | undefined>>): UsageSourceIdentity {
  const prefix = `YOROI_${settings.id.toUpperCase().replaceAll('-', '_')}`;
  const material = [settings.id, settings.executable, settings.home ?? env.HOME ?? '',
    settings.configDir ?? '', settings.secureStorageConfigDir ?? '', settings.signingKeyPath ?? '',
    settings.id === 'ollama-pro' ? ollamaKeyDigest(settings.signingKeyPath) : '',
    settings.id === 'claude' ? (settings.oauthToken === undefined ? claudeStoreDigest(settings, env) : accountHash(settings.oauthToken, 'oauth-store')) : '',
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
