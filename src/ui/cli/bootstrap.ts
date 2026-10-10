import { collectOnce } from "../../app/collect-once.js";
import { watchUsage } from "../../app/watch-usage.js";
import type { Scheduler } from "../../app/watch-usage.js";
import type { UsageResult, UsageSource } from "../../app/usage-source.js";
import { parseArgs } from "./args.js";
import { renderResults, renderPretty } from "./render.js";
import { getHelpText, USAGE } from "./help.js";
import { getZenLock, markZenExceeded, markZenOk } from "../../app/zen-lock.js";
import type { ZenLockStore } from "../../app/zen-lock-port.js";
import { zenFreeJsonStatus } from "./zen-free.js";
export { USAGE } from "./help.js";
export interface CliEnvironment {
  stdout(text: string): void;
  stderr(text: string): void;
}
export interface CliDependencies {
  readonly env: CliEnvironment;
  readonly sources: readonly UsageSource[];
  readonly zenLockStore?: ZenLockStore;
  readonly scheduler: Scheduler;
  readonly subscribeSignals: (handler: () => void) => () => void;
  readonly intervalMs?: number;
  readonly version?: string;
}
export interface CliProgram {
  run(argv: string[]): Promise<number>;
}
export const DEFAULT_INTERVAL_MS = 60_000;
export function createCli(deps: CliDependencies): CliProgram {
  const { env } = deps;
  const fail = (message: string): number => {
    env.stderr(`${message}\n${USAGE}`);
    return 2;
  };
  const print = (results: readonly UsageResult[], pretty: boolean,
    zenFree?: import("../../app/zen-lock-port.js").ZenLockState | null): void => {
    const lines = pretty ? renderPretty(results, zenFree) : renderResults(results, zenFree);
    for (const line of lines) env.stdout(line);
  };
  const runOnce = async (pretty: boolean): Promise<number> => {
    const results = await collectOnce(deps.sources);
    let zenFree;
    try { zenFree = deps.zenLockStore ? getZenLock(deps.zenLockStore) ?? null : undefined; }
    catch { zenFree = undefined; }
    print(results, pretty, zenFree);
    return results.length > 0 && results.every((result) => "error" in result) ? 1 : 0;
  };
  const runZenFree = (parsed: Extract<ReturnType<typeof parseArgs>, { kind: "zen-free" }>): number => {
    if (!deps.zenLockStore) { env.stderr("zen-free storage unavailable\n"); return 1; }
    const now = new Date().toISOString();
    const retryAt = parsed.retryAt ?? (parsed.retryInSeconds !== undefined
      ? new Date(Date.parse(now) + parsed.retryInSeconds * 1000).toISOString() : undefined);
    const state = parsed.operation === "exceeded" ? markZenExceeded(deps.zenLockStore, {
      observedAt: now, ...(parsed.model && { model: parsed.model }),
      ...(parsed.reason && { reason: parsed.reason }), ...(retryAt && { retryAt }),
    }) : parsed.operation === "ok" ? markZenOk(deps.zenLockStore, {
      observedAt: now, ...(parsed.model && { model: parsed.model }),
    }).state : getZenLock(deps.zenLockStore);
    if (parsed.json) { env.stdout(JSON.stringify(zenFreeJsonStatus(state ?? null))); return 0; }
    env.stdout(renderResults([], state ?? null)[0]!);
    return 0;
  };
  const runWatch = async (intervalMs: number, pretty: boolean): Promise<number> => {
    const controller = new AbortController();
    const unsubscribe = deps.subscribeSignals(() => controller.abort());
    try {
      const stream = watchUsage(deps.sources, deps.scheduler, controller.signal, intervalMs);
      for await (const results of stream) print(results, pretty);
      return 0;
    } finally {
      unsubscribe();
      controller.abort();
    }
  };
  return {
    async run(argv: string[]): Promise<number> {
      const parsed = parseArgs(argv);
      if (parsed.kind === "help") { env.stdout(getHelpText(parsed.subcommand)); return 0; }
      if (parsed.kind === "error") return fail(parsed.message);
      if (parsed.kind === "version") {
        if (deps.version === undefined) return fail("version unavailable");
        env.stdout(`yoroi ${deps.version}`);
        return 0;
      }
      if (parsed.kind === "zen-free") {
        try { return runZenFree(parsed); }
        catch { env.stderr("zen-free storage error\n"); return 1; }
      }
      if (deps.sources.length === 0) return fail("no providers configured");
      const pretty = Boolean(parsed.pretty);
      try {
        if (parsed.kind === "once") return await runOnce(pretty);
        return await runWatch(parsed.intervalMs ?? deps.intervalMs ?? DEFAULT_INTERVAL_MS, pretty);
      } catch (error) {
        env.stderr(`yoroi: ${error instanceof Error ? error.message : String(error)}`);
        return 2;
      }
    },
  };
}
