import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { HttpClient } from './http-client.js';
import type { OllamaAuthorization } from './ollama-key.js';
import { parseOllamaUsage } from './ollama-parser.js';
import { parseOllamaBalance } from './ollama-balance-parser.js';
import { createSnapshot } from '../domain/usage.js';

export class OllamaSource implements UsageSource {
  readonly provider = 'ollama-pro' as const;
  constructor(private readonly client: HttpClient, private readonly authorize: OllamaAuthorization,
    private readonly timeoutMs = 10000, private readonly now = () => new Date().toISOString()) {}
  async read(signal?: AbortSignal) {
    if (signal?.aborted) throw new SourceError('cancelled');
    const observedAt = this.now();
    const usage = parseOllamaUsage(await this.request('/api/usage', observedAt, signal), observedAt);
    if (!usage.windows.some(window => window.id.startsWith('activity:') && window.id !== 'activity:last-4-weeks')) {
      return usage;
    }
    const balance = parseOllamaBalance(await this.request('/api/balance', observedAt, signal), observedAt);
    return createSnapshot(this.provider, observedAt, [...balance.windows, ...usage.windows]);
  }
  private async request(path: string, observedAt: string, signal?: AbortSignal): Promise<string> {
    const uri = `${path}?ts=${Math.floor(Date.parse(observedAt) / 1000)}`;
    const authorization = await this.authorize(`GET,${uri}`);
    const response = await this.client.request({ method: 'GET', url: `https://ollama.com${uri}`,
      headers: { Authorization: authorization, Accept: 'application/json' },
      timeoutMs: this.timeoutMs }, signal);
    if (response.status === 401 || response.status === 403) throw new SourceError('authentication');
    if (response.status !== 200) throw new SourceError('unavailable');
    return response.body;
  }
}
