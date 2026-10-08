import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { HttpClient } from './http-client.js';
import { parseClaudeApiUsage } from './claude-api-parser.js';

export const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';

export class ClaudeSource implements UsageSource {
  readonly provider = 'claude' as const;
  constructor(private readonly client: HttpClient,
    private readonly authorize: (signal?: AbortSignal) => Promise<string>,
    private readonly timeoutMs = 10000,
    private readonly now = () => new Date().toISOString()) {}
  async read(signal?: AbortSignal) {
    if (signal?.aborted) throw new SourceError('cancelled');
    const token = await this.authorize(signal);
    if (signal?.aborted) throw new SourceError('cancelled');
    if (!token.trim()) throw new SourceError('authentication');
    const response = await this.client.request({
      method: 'GET', url: CLAUDE_USAGE_URL,
      headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': 'oauth-2025-04-20',
        Accept: 'application/json' },
      timeoutMs: this.timeoutMs,
    }, signal);
    if (response.status === 401 || response.status === 403) throw new SourceError('authentication');
    if (response.status !== 200) throw new SourceError('unavailable');
    return parseClaudeApiUsage(response.body, this.now());
  }
}
