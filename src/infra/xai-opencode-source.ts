import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { ProcessRunner } from './process-port.js';
import { parseXaiOpencodeStats, XAI_STATS_DAYS } from './xai-opencode-stats-parser.js';

/** Reads local opencode aggregates only: no credentials, network, token refresh or session content. */
export class XaiOpencodeSource implements UsageSource {
  readonly provider = 'xai' as const;
  constructor(private readonly runner: ProcessRunner, private readonly executable = 'opencode',
    private readonly timeoutMs = 10000, private readonly now = () => new Date().toISOString(),
    private readonly days = XAI_STATS_DAYS) {}
  async read(signal?: AbortSignal) {
    if (!Number.isSafeInteger(this.days) || this.days < 1) throw new SourceError('unavailable');
    const result = await this.runner.run({
      executable: this.executable, timeoutMs: this.timeoutMs,
      args: ['stats', '--json', '--models', '--cost', '--days', String(this.days)],
    }, signal);
    if (result.exitCode !== 0) throw new SourceError('exit');
    return parseXaiOpencodeStats(result.stdout, this.now(), this.days);
  }
}
