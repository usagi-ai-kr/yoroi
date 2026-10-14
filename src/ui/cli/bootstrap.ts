import { collectOnce } from "../../app/collect-once.js";
import type { UsageResult, UsageSource } from "../../app/usage-source.js";
import type { UsageResultMeta } from "../../app/usage-result-meta.js";
import { parseArgs } from "./args.js";
import { renderResults, renderPretty } from "./render.js";
import { getHelpText, USAGE } from "./help.js";
import { getZenLoadedAt, getZenLock, markZenExceeded, markZenLoaded, markZenOk } from "../../app/zen-lock.js";
import type { ZenLockStore } from "../../app/zen-lock-port.js";
import { renderZenFreeCommand, zenFreeJsonStatus } from "./zen-free.js";
export { USAGE } from "./help.js";
export interface CliEnvironment {
  stdout(text: string): void;
  stderr(text: string): void;
}
export interface CliDependencies {
  readonly env: CliEnvironment;
  readonly sources: readonly UsageSource[];
  readonly sourceMeta?: (source: UsageSource) => UsageResultMeta | undefined;
  readonly zenLockStore?: ZenLockStore;
  readonly subscribeSignals: (handler: () => void) => () => void;
  readonly version?: string;
}
export interface CliProgram {
  run(argv: string[]): Promise<number>;
}
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
    const controller = new AbortController();
    const unsubscribe = deps.subscribeSignals(() => controller.abort());
    try {
      const collected = await collectOnce(deps.sources, controller.signal);
      const results = collected.map((result, index) => {
        const meta = 'snapshot' in result ? deps.sourceMeta?.(deps.sources[index]!) : undefined;
        return meta ? { ...result, meta } : result;
      });
      let zenFree;
      try { zenFree = deps.zenLockStore ? getZenLock(deps.zenLockStore) ?? null : undefined; }
      catch { zenFree = undefined; }
      print(results, pretty, zenFree);
      return results.length > 0 && results.every((result) => "error" in result) ? 1 : 0;
    } finally {
      unsubscribe();
      controller.abort();
    }
  };
  const runZenFree = (parsed: Extract<ReturnType<typeof parseArgs>, { kind: "zen-free" }>): number => {
    if (!deps.zenLockStore) { env.stderr("zen-free storage unavailable\n"); return 1; }
    const now = new Date().toISOString();
    const retryAt = parsed.retryAt ?? (parsed.retryInSeconds !== undefined
      ? new Date(Date.parse(now) + parsed.retryInSeconds * 1000).toISOString() : undefined);
    if (parsed.operation === "loaded") markZenLoaded(deps.zenLockStore, { observedAt: now, ...(parsed.marker && { version: parsed.marker }) });
    const state = parsed.operation === "exceeded" ? markZenExceeded(deps.zenLockStore, {
      observedAt: now, ...(parsed.model && { model: parsed.model }),
      ...(parsed.reason && { reason: parsed.reason }), ...(retryAt && { retryAt }),
    }) : parsed.operation === "ok" ? markZenOk(deps.zenLockStore, {
      observedAt: now, ...(parsed.model && { model: parsed.model }),
    }).state : getZenLock(deps.zenLockStore);
    const loadedAt = getZenLoadedAt(deps.zenLockStore);
    if (parsed.json) { env.stdout(JSON.stringify(zenFreeJsonStatus(state ?? null, new Date(), loadedAt))); return 0; }
    env.stdout(renderZenFreeCommand(state ?? null, loadedAt));
    return 0;
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
      if (parsed.kind === "detect") return fail("detect must be started through the composition root");
      if (parsed.kind === "insights") return fail("insights must be started through the composition root");
      if (parsed.kind === "zen-free") {
        try { return runZenFree(parsed); }
        catch { env.stderr("zen-free storage error\n"); return 1; }
      }
      if (deps.sources.length === 0) return fail("no providers configured");
      const pretty = Boolean(parsed.pretty);
      try {
        return await runOnce(pretty);
      } catch (error) {
        env.stderr(`yoroi: ${error instanceof Error ? error.message : String(error)}`);
        return 2;
      }
    },
  };
}
