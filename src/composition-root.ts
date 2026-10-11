import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createCli, type CliEnvironment, type CliProgram } from './ui/cli/bootstrap.js';
import { nodeEnvironment, processSignals } from './ui/cli/runtime.js';
import { parseArgs } from './ui/cli/args.js';
import { loadConfig } from './config/load-config.js';
import { createSources, type SourceFactories } from './composition/sources.js';
import { cacheSources, openUsagePersistence, type UsagePersistence } from './composition/cache.js';
import { dataEnvironment } from './composition/data-env.js';
import { CachedSource } from './app/cached-source.js';
import type { UsageClock } from './app/usage-cache-port.js';
import type { ZenLockStore } from './app/zen-lock-port.js';
import { MemoryZenLockStore } from './app/zen-lock-memory.js';
import { openZenLockStore } from './infra/sqlite/zen-lock-store.js';
import { DB_FILE_NAME, resolveDataDir } from './infra/sqlite/data-dir.js';
import metadata from '../package.json' with { type: 'json' };

export interface CompositionOptions {
  readonly configEnv?: Readonly<Record<string, string | undefined>>;
  readonly output?: CliEnvironment;
  readonly factories?: SourceFactories;
  readonly subscribeSignals?: (handler: () => void) => () => void;
  readonly zenLockStore?: ZenLockStore;
  readonly openUsagePersistence?: () => UsagePersistence | undefined;
  readonly dataDir?: string;
  readonly clock?: UsageClock;
}

async function runWithStore(cli: CliProgram, argv: string[], store: ZenLockStore,
  shouldClose: boolean): Promise<number> {
  try { return await cli.run(argv); }
  finally { if (shouldClose) try { store.close(); } catch { /* preserve the CLI result */ } }
}

const HISTORY_RETENTION_DAYS = 90;
const MAX_SAMPLES_PER_SERIES = 1000;
/** once 종료 시 만료 캐시·오래된 이력을 정리한다. 실패는 공급자 조회/결과에 영향을 주지 않는다. */
function prunePersistence(persistence: UsagePersistence, now: number): void {
  try { persistence.cache.prune(now); } catch { /* best effort */ }
  try {
    const before = new Date(now - HISTORY_RETENTION_DAYS * 86_400_000).toISOString();
    persistence.history.prune({ before, maxSamples: MAX_SAMPLES_PER_SERIES });
  } catch { /* best effort */ }
}

export function compose(options: CompositionOptions = {}): CliProgram {
  const env = options.output ?? nodeEnvironment;
  const subscribeSignals = options.subscribeSignals ?? processSignals;
  return { async run(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === 'help' || parsed.kind === 'version' || parsed.kind === 'error') {
      return createCli({ env, sources: [], subscribeSignals, version: metadata.version }).run(argv);
    }
    const dataEnv = dataEnvironment(options.configEnv, options.dataDir);
    if (parsed.kind === 'zen-free') {
      if (parsed.operation === 'status' && !options.zenLockStore &&
        !existsSync(join(resolveDataDir(dataEnv), DB_FILE_NAME))) {
        const store = new MemoryZenLockStore();
        return runWithStore(createCli({ env, sources: [], zenLockStore: store, subscribeSignals }), argv, store, true);
      }
      let store: ZenLockStore;
      try { store = options.zenLockStore ?? openZenLockStore(dataEnv); }
      catch { env.stderr('zen-free storage error\n'); return 1; }
      const cli = createCli({ env, sources: [], zenLockStore: store, subscribeSignals });
      return runWithStore(cli, argv, store, true);
    }
    let config;
    try { config = loadConfig(options.configEnv ?? process.env); }
    catch (error) {
      env.stderr(error instanceof Error ? error.message : 'Invalid runtime configuration');
      return 2;
    }
    const configEnv = options.configEnv ?? process.env;
    let sources = createSources(config, options.factories);
    let persistence: UsagePersistence | undefined;
    try {
      persistence = options.openUsagePersistence ? options.openUsagePersistence() : openUsagePersistence(dataEnv);
      if (persistence) sources = cacheSources(sources, config, configEnv, persistence, Boolean(parsed.refresh), options.clock);
    } catch { /* cache opening failures preserve provider collection */ }
    let store: ZenLockStore | undefined = options.zenLockStore;
    let shouldClose = Boolean(store);
    if (!store) {
      const dbExists = existsSync(join(resolveDataDir(dataEnv), DB_FILE_NAME));
      if (dbExists) {
        try { store = openZenLockStore(dataEnv); shouldClose = true; } catch { /* keep provider output */ }
      } else store = new MemoryZenLockStore();
    }
    const cli = createCli({ env, sources, ...(store && { zenLockStore: store }),
      sourceMeta: source => source instanceof CachedSource ? source.meta : undefined,
      subscribeSignals, version: metadata.version });
    try { return await (store ? runWithStore(cli, argv, store, shouldClose) : cli.run(argv)); }
    finally {
      if (persistence) prunePersistence(persistence, options.clock?.() ?? Date.now());
      try { persistence?.close(); } catch { /* preserve the CLI result */ }
    }
  } };
}
