import { collectOnce } from "../../app/collect-once.js";
import { watchUsage } from "../../app/watch-usage.js";
import type { Scheduler } from "../../app/watch-usage.js";
import type { UsageResult, UsageSource } from "../../app/usage-source.js";
import { parseArgs } from "./args.js";
import { renderResults, renderPretty } from "./render.js";
import { getHelpText, USAGE } from "./help.js";

export { USAGE } from "./help.js";

export interface CliEnvironment {
  stdout(text: string): void;
  stderr(text: string): void;
}

export interface CliDependencies {
  readonly env: CliEnvironment;
  readonly sources: readonly UsageSource[];
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
  const print = (results: readonly UsageResult[], pretty: boolean): void => {
    const lines = pretty ? renderPretty(results) : renderResults(results);
    for (const line of lines) env.stdout(line);
  };
  const runOnce = async (pretty: boolean): Promise<number> => {
    const results = await collectOnce(deps.sources);
    print(results, pretty);
    return results.length > 0 && results.every((result) => "error" in result) ? 1 : 0;
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
