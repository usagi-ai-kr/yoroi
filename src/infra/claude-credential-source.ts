import { join } from 'node:path';

export interface ClaudeCredentialLocation {
  readonly configDir?: string;
  readonly secureStorageConfigDir?: string;
  readonly home?: string;
  readonly platform?: string;
}

/** Resolve only the credential file location; never query Keychain or read credentials. */
export function claudeCredentialPath(options: ClaudeCredentialLocation): string | undefined {
  const platform = options.platform ?? process.platform;
  const dir = (platform === 'darwin' ? options.secureStorageConfigDir : undefined) ??
    options.configDir ?? (options.home?.trim() ? join(options.home, '.claude') : undefined);
  return dir?.trim() ? join(dir, '.credentials.json') : undefined;
}
