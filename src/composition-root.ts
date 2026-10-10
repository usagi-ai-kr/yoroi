import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCli, type CliEnvironment, type CliProgram } from './ui/cli/bootstrap.js';
import { nodeEnvironment, processSignals } from './ui/cli/runtime.js';
import { parseArgs } from './ui/cli/args.js';
import { loadConfig } from './config/load-config.js';
import { createSources, type SourceFactories } from './composition/sources.js';
import { TimerScheduler } from './infra/scheduler.js';
import type { Scheduler } from './app/watch-usage.js';
import type { ZenLockStore } from './app/zen-lock-port.js';
import { MemoryZenLockStore } from './app/zen-lock-memory.js';
import { openZenLockStore } from './infra/sqlite/zen-lock-store.js';
import { DB_FILE_NAME, resolveDataDir } from './infra/sqlite/data-dir.js';
import metadata from '../package.json' with { type: 'json' };

export interface CompositionOptions {
  readonly configEnv?: Readonly<Record<string, string | undefined>>;
  readonly output?: CliEnvironment;
  readonly factories?: SourceFactories;
  readonly scheduler?: Scheduler;
  readonly subscribeSignals?: (handler: () => void) => () => void;
  readonly zenLockStore?: ZenLockStore;
}

async function runWithStore(cli: CliProgram, argv: string[], store: ZenLockStore,
  shouldClose: boolean): Promise<number> {
  try { return await cli.run(argv); }
  finally { if (shouldClose) try { store.close(); } catch { /* preserve the CLI result */ } }
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
    if (parsed.kind === 'zen-free') {
      let store: ZenLockStore;
      try { store = options.zenLockStore ?? openZenLockStore(process.env); }
      catch { env.stderr('zen-free storage error\n'); return 1; }
      const cli = createCli({ env, sources: [], zenLockStore: store, scheduler, subscribeSignals });
      return runWithStore(cli, argv, store, true);
    }
    let config;
    try { config = loadConfig(options.configEnv ?? process.env); }
    catch (error) {
      env.stderr(error instanceof Error ? error.message : 'Invalid runtime configuration');
      return 2;
    }
    const sources = createSources(config, options.factories);
    if (parsed.kind === 'watch') return createCli({ env, sources, scheduler, subscribeSignals,
      intervalMs: config.intervalMs, version: metadata.version }).run(argv);
    let store: ZenLockStore | undefined = options.zenLockStore;
    let shouldClose = Boolean(store);
    if (!store) {
      const dbExists = existsSync(join(resolveDataDir(process.env), DB_FILE_NAME));
      if (dbExists) {
        try { store = openZenLockStore(process.env); shouldClose = true; } catch { /* keep provider output */ }
      } else store = new MemoryZenLockStore();
    }
    const cli = createCli({ env, sources, ...(store && { zenLockStore: store }), scheduler,
      subscribeSignals, intervalMs: config.intervalMs, version: metadata.version });
    return store ? runWithStore(cli, argv, store, shouldClose) : cli.run(argv);
  } };
}
