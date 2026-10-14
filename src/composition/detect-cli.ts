import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { DEFAULT_DETECT_INTERVAL_MS, type DetectSleep } from '../app/detect-scheduler.js';
import { SourceError } from '../app/usage-source.js';
import { loadConfig, opencodeTarget } from '../config/load-config.js';
import { resolveDbPath } from '../infra/sqlite/data-dir.js';
import { opencodeStartedAtMs, type SyncProcessRun } from '../infra/opencode-process.js';
import { openDetectStateStore } from '../infra/sqlite/detect-state-store.js';
import type { CliEnvironment } from '../ui/cli/bootstrap.js';
import type { DetectParsedArgs } from '../ui/cli/detect-args.js';
import { runDetectCommand, type DetectCommandDeps } from '../ui/cli/detect-command.js';
import { releaseDetectLease, runDetectCycle, type DetectCycleDeps } from './detect.js';

const MIN = 60_000;
/** Stale > 3x the slowest default probe interval (30 min) so a healthy budget never looks stale. */
const THRESHOLDS = { surgePercentPoints: 20, staleAfterMs: 90 * MIN, pluginStaleGraceMs: 10 * MIN };

/** Test hooks; production passes none. `cycle` overrides cycle dependencies (fake sources, platform, ...). */
export interface DetectCliOptions {
  readonly intervalMs?: number; readonly sleep?: DetectSleep; readonly now?: () => number;
  readonly owner?: string; readonly cycle?: Partial<DetectCycleDeps>;
  /** Injected `ps` runner (tests never shell out). Omit in production to read the real OpenCode start. */
  readonly runProcess?: SyncProcessRun;
}
const timerSleep: DetectSleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new SourceError('cancelled')); return; }
  const abort = (): void => { clearTimeout(timer); reject(new SourceError('cancelled')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  signal.addEventListener('abort', abort, { once: true });
});

/** Wires the foreground detector: config + DT7 cycle + DT1 scheduler through the UI command. Notifications are
 * stdout only; persistence/supervision (pm2) stays outside the process. */
export function runDetectCli(parsed: Extract<DetectParsedArgs, { kind: 'detect' }>, ctx: {
  env: CliEnvironment; subscribeSignals: (handler: () => void) => () => void;
  configEnv: Readonly<Record<string, string | undefined>>; dataEnv: NodeJS.ProcessEnv; options?: DetectCliOptions }): Promise<number> {
  const { env, configEnv, dataEnv, options: o = {} } = ctx;
  let config, opencodeTargetValue: 'v1' | 'v2';
  try { config = loadConfig(configEnv); opencodeTargetValue = opencodeTarget(configEnv); }
  catch (error) { env.stderr(error instanceof Error ? error.message : 'Invalid runtime configuration'); return Promise.resolve(2); }
  const now = o.now ?? Date.now, intervalMs = o.intervalMs ?? DEFAULT_DETECT_INTERVAL_MS;
  const owner = o.owner ?? `detector-${process.pid}-${randomBytes(3).toString('hex')}`;
  // One read-only `ps` per cycle feeds plugin-staleness; v2(p45)는 공용 서비스라 ps를 아예 호출하지 않는다.
  const probe = opencodeTargetValue === 'v2' ? undefined
    : o.runProcess === undefined ? opencodeStartedAtMs(undefined, now) : opencodeStartedAtMs(o.runProcess, now);
  const deps: DetectCommandDeps = { now, intervalMs, sleep: o.sleep ?? timerSleep, subscribeSignals: ctx.subscribeSignals,
    opencodeTarget: opencodeTargetValue,
    runCycle: signal => runDetectCycle({ config, env: configEnv, dataEnv, now, owner, intervalMs, thresholds: THRESHOLDS, signal,
      opencodeTarget: opencodeTargetValue, ...(probe && { opencodeStartedAtMs: probe }), ...o.cycle }),
    releaseLease: () => releaseDetectLease(owner, () => openDetectStateStore(dataEnv)),
    readLease: () => {
      if (!existsSync(resolveDbPath(dataEnv))) return undefined;
      const store = openDetectStateStore(dataEnv);
      try { return store.getLease(); } finally { store.close(); }
    } };
  return runDetectCommand(parsed, deps, env);
}
