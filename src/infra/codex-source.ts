import metadata from '../../package.json' with { type: 'json' };
import { SourceError, type UsageSource } from '../app/usage-source.js';
import type { ProcessRunner } from './process-port.js';
import { parseCodexOutput } from './codex-parser.js';

export class CodexSource implements UsageSource {
  readonly provider = 'codex' as const;
  constructor(private readonly runner: ProcessRunner, private readonly executable = 'codex',
    private readonly timeoutMs = 10000, private readonly now = () => new Date().toISOString()) {}
  async read(signal?: AbortSignal) {
    const initialize = JSON.stringify({ id: 1, method: 'initialize', params: {
      clientInfo: { name: 'yoroi', title: 'Yoroi', version: metadata.version },
    } });
    const initialized = JSON.stringify({ method: 'initialized', params: {} });
    const query = JSON.stringify({ id: 2, method: 'account/rateLimits/read' });
    const result = await this.runner.run({ executable: this.executable,
      args: ['app-server', '--stdio'], timeoutMs: this.timeoutMs,
      steps: [{ input: initialize + '\n', responseId: 1 },
        { input: initialized + '\n' + query + '\n', responseId: 2 }] }, signal);
    if (result.exitCode !== 0) throw new SourceError('exit');
    return parseCodexOutput(result.stdout, this.now());
  }
}
