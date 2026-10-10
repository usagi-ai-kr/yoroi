import { createHash } from 'node:crypto';
import { readFile as fsReadFile } from 'node:fs/promises';
import { claudeCredentialPath } from './claude-credential-source.js';
import { userInfo } from 'node:os';
import { SourceError } from '../app/usage-source.js';
import { digest, parseClaudeCredentials } from './claude-principal.js';
import type { ProcessRunner } from './process-port.js';

export interface ClaudeAuthOptions {
  readonly oauthToken?: string;
  readonly configDir?: string;
  readonly secureStorageConfigDir?: string;
  readonly account?: string;
  readonly home?: string;
  readonly platform?: string;
  readonly readFile?: (path: string) => Promise<string>;
  readonly now?: () => number;
}

interface Resolved { readonly token: string; readonly principal: string }
/** Calling it yields the token; `principal` yields the account digest of the same single credential read. */
export type ClaudeAuthorizer = ((signal?: AbortSignal) => Promise<string>) &
  { readonly principal: (signal?: AbortSignal) => Promise<string> };

export function claudeAuthorization(
  options: ClaudeAuthOptions,
  runner: ProcessRunner,
): ClaudeAuthorizer {
  const platform = options.platform ?? process.platform;
  const now = options.now ?? (() => Date.now());
  const read = options.readFile ?? ((path: string) => fsReadFile(path, 'utf8'));

  const resolve = async (signal?: AbortSignal): Promise<Resolved> => {
    if (signal?.aborted) throw new SourceError('cancelled');
    if (options.oauthToken !== undefined) {
      const trimmed = options.oauthToken.trim();
      if (!trimmed) throw new SourceError('authentication');
      if (signal?.aborted) throw new SourceError('cancelled');
      return { token: trimmed, principal: digest('cred', trimmed) };
    }
    if (options.configDir !== undefined && !options.configDir.trim()) {
      throw new SourceError('authentication');
    }
    if (platform === 'darwin') {
      const configDir = options.secureStorageConfigDir ?? options.configDir;
      if (configDir !== undefined && !configDir.trim()) throw new SourceError('authentication');
      const service = configDir
        ? `Claude Code-credentials-${createHash('sha256').update(configDir.normalize('NFC')).digest('hex').slice(0, 8)}`
        : 'Claude Code-credentials';
      try {
        const output = await runner.run({
          executable: 'security',
          args: ['find-generic-password', '-a', options.account ?? userInfo().username, '-s', service, '-w'],
          timeoutMs: 5000,
        }, signal);
        if (signal?.aborted) throw new SourceError('cancelled');
        if (output.exitCode !== 0) throw new SourceError('authentication');
        return parseClaudeCredentials(output.stdout, now());
      } catch (error) {
        if (signal?.aborted || (error instanceof SourceError && error.code === 'cancelled')) {
          throw new SourceError('cancelled');
        }
        // Missing/expired Keychain credentials may have a valid same-profile file below.
      }
    }
    const path = claudeCredentialPath(options);
    if (!path) throw new SourceError('authentication');
    let raw;
    try {
      raw = await read(path);
    } catch (error) {
      if (signal?.aborted || (error instanceof SourceError && error.code === 'cancelled')) {
        throw new SourceError('cancelled');
      }
      throw new SourceError('authentication');
    }
    if (signal?.aborted) throw new SourceError('cancelled');
    return parseClaudeCredentials(raw, now());
  };
  // principal() reads credentials once; the next authorize() in the same collection reuses that result.
  let pending: Promise<Resolved> | undefined;
  const authorize = async (signal?: AbortSignal) => {
    const reuse = pending; pending = undefined;
    return (await (reuse ?? resolve(signal))).token;
  };
  const principal = (signal?: AbortSignal) => {
    pending = resolve(signal);
    pending.catch(() => undefined);
    return pending.then(r => r.principal);
  };
  return Object.assign(authorize, { principal });
}
