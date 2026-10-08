import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { ProcessRunner } from './process-port.js';
import { checkAuth, parseClaudeUsage } from './cli-usage-parser.js';

export class ClaudeSource implements UsageSource {
  readonly provider = 'claude' as const;
  constructor(private readonly runner: ProcessRunner, private readonly executable = 'claude',
    private readonly timeoutMs = 10000, private readonly now = () => new Date().toISOString()) {}
  async read(signal?: AbortSignal) {
    const result = await this.runner.run({
      executable: this.executable, args: ['-p', '/usage'], timeoutMs: this.timeoutMs,
    }, signal);
    checkAuth(result.stderr);
    checkAuth(result.stdout);
    if (result.exitCode !== 0) throw new SourceError('exit');
    return parseClaudeUsage(result.stdout, this.now());
  }
}
