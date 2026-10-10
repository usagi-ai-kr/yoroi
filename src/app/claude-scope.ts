import type { UsageCacheKey } from './usage-cache-port.js';
import type { UsageSource } from './usage-source.js';

/** Resolves the non-secret account digest of the credential about to be used (one credential read).
 * The adapter must reuse that read for the following source.read, never repeat it. */
export type PrincipalResolver = (signal?: AbortSignal) => Promise<string>;
export type PrincipalSource = UsageSource & { readonly principal: PrincipalResolver };

export function hasPrincipal(source: UsageSource): source is PrincipalSource {
  return typeof (source as Partial<PrincipalSource>).principal === 'function';
}
/** Final scope = base scope + account digest; undefined when the digest is not a safe identifier. */
export function principalKey(key: UsageCacheKey, principal: string): UsageCacheKey | undefined {
  const scope = `${key.scope}.${principal}`;
  return /^[A-Za-z0-9._:@-]{1,64}$/.test(scope) ? { ...key, scope } : undefined;
}
