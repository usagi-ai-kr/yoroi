import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { HttpClient } from './http-client.js';
import { parseOpenCodeGoUsage } from './opencode-go-parser.js';

export const OPENCODE_GO_USAGE_URL = 'https://opencode.ai/zen/go/v1/usage';

export class OpenCodeGoSource implements UsageSource {
  readonly provider = 'opencode-go' as const;
  constructor(private readonly client: HttpClient, private readonly apiKey: string,
    private readonly timeoutMs = 10000, private readonly now = () => new Date().toISOString()) {}
  async read(signal?: AbortSignal) {
    if (!this.apiKey.trim()) throw new SourceError('authentication');
    const response = await this.client.request({ method: 'GET', url: OPENCODE_GO_USAGE_URL,
      headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
      timeoutMs: this.timeoutMs }, signal);
    if (response.status === 401 || response.status === 403) throw new SourceError('authentication');
    if (response.status === 429) throw new SourceError('unavailable');
    if (response.status !== 200) throw new SourceError('unavailable');
    return parseOpenCodeGoUsage(response.body, this.now());
  }
}
