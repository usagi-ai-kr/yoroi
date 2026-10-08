import { createCli, type CliEnvironment, type CliProgram } from './ui/cli/bootstrap.js';
import { nodeEnvironment, processSignals } from './ui/cli/runtime.js';
import { parseArgs } from './ui/cli/args.js';
import { loadConfig } from './config/load-config.js';
import { createSources, type SourceFactories } from './composition/sources.js';
import { TimerScheduler } from './infra/scheduler.js';
import type { Scheduler } from './app/watch-usage.js';
import metadata from '../package.json' with { type: 'json' };

export interface CompositionOptions {
  readonly configEnv?: Readonly<Record<string, string | undefined>>;
  readonly output?: CliEnvironment;
  readonly factories?: SourceFactories;
  readonly scheduler?: Scheduler;
  readonly subscribeSignals?: (handler: () => void) => () => void;
}
export function compose(options: CompositionOptions = {}): CliProgram {
  const env = options.output ?? nodeEnvironment;
  const scheduler = options.scheduler ?? new TimerScheduler();
  const subscribeSignals = options.subscribeSignals ?? processSignals;
  return { async run(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === 'help' || parsed.kind === 'version' || parsed.kind === 'error') {
      return createCli({ env, sources: [], scheduler, subscribeSignals, version: metadata.version }).run(argv);
    }
    let config;
    try { config = loadConfig(options.configEnv ?? process.env); }
    catch (error) {
      env.stderr(error instanceof Error ? error.message : 'Invalid runtime configuration');
      return 2;
    }
    const sources = createSources(config, options.factories);
    return createCli({ env, sources, scheduler, subscribeSignals,
      intervalMs: config.intervalMs, version: metadata.version }).run(argv);
  } };
}
