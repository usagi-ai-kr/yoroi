import type { ProviderId, UsageSnapshot } from '../domain/usage.js';

export type SourceErrorCode = 'authentication' | 'not-installed' | 'parse' | 'timeout' |
  'network' | 'unavailable' | 'cancelled' | 'exit';
const messages: Record<SourceErrorCode, string> = {
  authentication: 'Authentication is required',
  'not-installed': 'CLI executable is not installed',
  parse: 'Usage response format is unsupported',
  timeout: 'Usage query timed out',
  network: 'Usage query connection failed',
  unavailable: 'Usage query is unavailable',
  cancelled: 'Usage query was cancelled',
  exit: 'Usage CLI exited unsuccessfully',
};
export class SourceError extends Error {
  readonly code: SourceErrorCode;
  constructor(code: SourceErrorCode) {
    super(messages[code]);
    this.name = 'SourceError';
    this.code = code;
  }
}
export interface UsageSource {
  readonly provider: ProviderId;
  read(signal?: AbortSignal): Promise<UsageSnapshot>;
}
export type UsageResult =
  { readonly provider: ProviderId; readonly snapshot: UsageSnapshot } |
  { readonly provider: ProviderId; readonly error: SourceError };
