import { createHash } from 'node:crypto';
import { SourceError } from '../app/usage-source.js';

/** Credential bytes contribute only via one-way SHA-256 digest; raw secrets never enter scope/log/DB. */
export function digest(tag: string, raw: string | Buffer): string {
  return `${tag}-${createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
}

/** Per-user identifiers only. organizationId/subscriptionId are shared by several users, so using
 * them would merge distinct accounts into one scope (isolation beats continuity). */
const USER_IDS = ['email', 'accountId', 'userId', 'account_id', 'user_id'] as const;

interface Parsed { readonly token: string; readonly principal: string; readonly expiresAt: unknown }

function extract(content: string): Parsed {
  const data = JSON.parse(content) as Record<string, unknown>;
  const oauth = data.claudeAiOauth as Record<string, unknown>;
  const token = oauth.accessToken;
  if (typeof token !== 'string' || !token.trim()) throw new Error();
  for (const holder of [data, oauth]) {
    for (const key of USER_IDS) {
      const id = holder[key];
      if (typeof id === 'string' && id.trim()) {
        return { token: token.trim(), principal: digest('stable', id.trim()), expiresAt: oauth.expiresAt };
      }
    }
  }
  return { token: token.trim(), principal: digest('cred', token.trim()), expiresAt: oauth.expiresAt };
}

/** Account digest of a credential dump without expiry checks, for file-backed scope on non-Keychain paths. */
export function claudePrincipal(content: string): string | undefined {
  try { return extract(content).principal; } catch { return undefined; }
}

/** Strict parse used for authentication: valid, unexpired OAuth token plus its account digest. */
export function parseClaudeCredentials(content: string, now: number): { token: string; principal: string } {
  try {
    const { token, principal, expiresAt } = extract(content);
    if (typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= 0 || now >= expiresAt) {
      throw new Error();
    }
    return { token, principal };
  } catch {
    throw new SourceError('authentication');
  }
}
