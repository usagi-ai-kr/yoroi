import { runInsights } from './insights.js';
import { renderTop10FromRecords } from '../insights/letter-top10-render.js';
import { renderTop10MarkdownFromRecords } from '../insights/letter-markdown.js';
import { NodeProcessRunner } from '../infra/process-runner.js';
import type { ProcessRunner } from '../infra/process-port.js';
import type { InsightHistoryPort } from '../insights/history-port.js';
import type { InsightSourcePort } from '../insights/source-port.js';
import type { InsightPortOptions } from '../insights/sources.js';
import type { HttpClient } from '../infra/http-client.js';
import type { CliEnvironment } from '../ui/cli/bootstrap.js';
import type { InsightsParsedArgs } from '../ui/cli/insights-args.js';
import { runInsightsCommand, type InsightsCommandDeps } from '../ui/cli/insights-command.js';
import type { InsightLetterView } from '../ui/cli/insights-view.js';

/** Composition-owned wiring options. Tests inject history/ports/clock; production passes none.
 * HTTP keys come from the config env and are never logged. */
export interface InsightsCliOptions {
  readonly http?: HttpClient;
  readonly processRunner?: ProcessRunner;
  readonly clock?: () => number;
  readonly sourceOptions?: Omit<InsightPortOptions, 'now'>;
  readonly openHistory?: () => InsightHistoryPort & { close(): void };
  readonly createPorts?: (client: HttpClient, lookup: (name: string) => string | undefined,
    options: InsightPortOptions) => readonly InsightSourcePort[];
}

/** Wires `yoroi insights once` to the existing internal run (O1). Opens and closes one history per run;
 * output, exit codes and abort handling stay in the ui command. No delivery, scheduling or LLM here. */
export function runInsightsCli(parsed: Extract<InsightsParsedArgs, { kind: 'insights' }>, ctx: {
  readonly env: CliEnvironment;
  readonly subscribeSignals: (handler: () => void) => () => void;
  readonly configEnv: Readonly<Record<string, string | undefined>>;
  readonly dataEnv: NodeJS.ProcessEnv;
  readonly options?: InsightsCliOptions;
}): Promise<number> {
  const opts = ctx.options;
  const deps: InsightsCommandDeps = {
    subscribeSignals: ctx.subscribeSignals,
    run: async ({ refresh, signal }) => {
      const outcome = await runInsights({ env: ctx.configEnv, dataEnv: ctx.dataEnv,
        ...(opts?.http && { http: opts.http }), ...(opts?.clock && { clock: opts.clock }),
        processRunner: opts?.processRunner ?? new NodeProcessRunner(),
        ...(opts?.sourceOptions && { sourceOptions: opts.sourceOptions }),
        ...(opts?.openHistory && { openHistory: opts.openHistory }), ...(opts?.createPorts && { createPorts: opts.createPorts }),
        ...(refresh && { refresh: true }), ...(signal && { signal }) });
      const letter: InsightLetterView = outcome.letter;
      const top10 = outcome.top10 ?? { records: [], arenaRecords: [], openrouterRecords: [], previousRanks: [], failedSources: [] };
      const warnings = (top10 as { warnings?: readonly string[] }).warnings;
      const partialSources = outcome.sources.filter(s => s.partial === true).map(s => s.source);
      const top10Payload = { publicationDate: outcome.publicationDate, ...top10, ...(warnings && warnings.length ? { notes: warnings } : {}),
        ...(partialSources.length ? { partialSources } : {}) };
      return { letter, storage: outcome.storage, compact: renderTop10FromRecords(top10Payload),
        markdown: renderTop10MarkdownFromRecords(top10Payload) };
    },
  };
  return runInsightsCommand(parsed, deps, ctx.env);
}
