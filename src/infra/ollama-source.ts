import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { HttpClient } from './http-client.js';
import type { OllamaAuthorization } from './ollama-key.js';
import { parseOllamaUsage } from './ollama-parser.js';
import { parseOllamaBalance } from './ollama-balance-parser.js';
import { createSnapshot, type UsageSnapshot } from '../domain/usage.js';

export class OllamaSource implements UsageSource {
  readonly provider = 'ollama-pro' as const;
  constructor(private readonly client: HttpClient, private readonly authorize: OllamaAuthorization,
    private readonly timeoutMs = 10000, private readonly now = () => new Date().toISOString()) {}
  async read(signal?: AbortSignal): Promise<UsageSnapshot> {
    if (signal?.aborted) throw new SourceError('cancelled');
    const observedAt = this.now();
    // A single source-level deadline bounds the whole read. The sequential usage -> balance
    // pair would otherwise spend up to two timeouts, so the worst case is one timeout.
    const start = Date.now();
    const deadline = AbortSignal.timeout(this.timeoutMs);
    // The composite scope reaches the in-flight requests too, so nothing survives the
    // deadline: an expired read leaves no pending HTTP work behind.
    const scope = signal ? AbortSignal.any([signal, deadline]) : deadline;
    const guard = this.guard(scope, signal);
    try {
      return await Promise.race([this.collect(observedAt, start, scope, signal), guard.promise]);
    } finally {
      guard.dispose();
    }
  }
  private async collect(observedAt: string, start: number, scope: AbortSignal,
    parent: AbortSignal | undefined): Promise<UsageSnapshot> {
    const usage = parseOllamaUsage(
      await this.request('/api/usage', observedAt, scope, parent, this.timeoutMs), observedAt);
    if (!usage.windows.some(window => window.id.startsWith('activity:') && window.id !== 'activity:last-4-weeks')) {
      return usage;
    }
    // The second call may only spend what is left of the same deadline, never a fresh timeout.
    // An exhausted remainder must not enter the request at all.
    const budget = this.remaining(start);
    if (budget <= 0) throw new SourceError('timeout');
    const balance = parseOllamaBalance(
      await this.request('/api/balance', observedAt, scope, parent, budget), observedAt);
    return createSnapshot(this.provider, observedAt, [...balance.windows, ...usage.windows]);
  }
  /** The client reports an aborted signal as cancelled, so the scope is resolved back here. */
  private reclassify(error: unknown, scope: AbortSignal, parent: AbortSignal | undefined): never {
    if (parent?.aborted) throw new SourceError('cancelled');
    if (scope.aborted) throw new SourceError('timeout');
    throw error;
  }
  /** Parent cancellation wins over the deadline so callers keep the cancelled contract. */
  private guard(scope: AbortSignal, signal?: AbortSignal) {
    let onAbort: (() => void) | undefined;
    const promise = new Promise<never>((_, reject) => {
      const fail = () => reject(new SourceError(signal?.aborted ? 'cancelled' : 'timeout'));
      if (scope.aborted) fail();
      else { onAbort = fail; scope.addEventListener('abort', fail, { once: true }); }
    });
    promise.catch(() => {});
    return { promise, dispose: () => { if (onAbort) scope.removeEventListener('abort', onAbort); } };
  }
  /** Remaining budget of the single deadline. Zero or less means the deadline is already spent. */
  private remaining(start: number): number {
    const left = start + this.timeoutMs - Date.now();
    return Number.isFinite(left) ? Math.ceil(left) : 0;
  }
  private async request(path: string, observedAt: string, scope: AbortSignal,
    parent: AbortSignal | undefined, timeoutMs: number): Promise<string> {
    const uri = `${path}?ts=${Math.floor(Date.parse(observedAt) / 1000)}`;
    const authorization = await this.authorize(`GET,${uri}`);
    let response;
    try {
      response = await this.client.request({ method: 'GET', url: `https://ollama.com${uri}`,
        headers: { Authorization: authorization, Accept: 'application/json' },
        timeoutMs }, scope);
    } catch (error) {
      this.reclassify(error, scope, parent);
    }
    if (response.status === 401 || response.status === 403) throw new SourceError('authentication');
    if (response.status !== 200) throw new SourceError('unavailable');
    return response.body;
  }
}
