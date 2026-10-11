import type { InsightHistoryPort } from '../insights/history-port.js';
import { MemoryInsightHistory } from '../insights/history-memory.js';
import { runInsightsOnce, type InsightRunResult } from '../insights/run-once.js';
import type { InsightSourcePort } from '../insights/source-port.js';
import { createInsightSourcePorts, type InsightPortOptions } from '../insights/sources.js';
import { NodeHttpClient, type HttpClient } from '../infra/http-client.js';
import { openInsightsHistory } from '../infra/sqlite/insights-store.js';

export interface InsightsRunOptions {
  /** Provider/key environment (AA and OpenRouter keys come from the usual .env/process env; values are never logged). */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Data-dir environment (YOROI_DATA_DIR etc.), like `once`. */
  readonly dataEnv: NodeJS.ProcessEnv;
  readonly http?: HttpClient;
  /** Epoch ms clock; the KST publication day and all timestamps derive from it. */
  readonly clock?: () => number;
  readonly refresh?: boolean;
  readonly signal?: AbortSignal;
  /** Request policy hooks (sleep/policy) for the source ports. */
  readonly sourceOptions?: Omit<InsightPortOptions, 'now'>;
  /** Test hooks: replace the SQLite history or the whole port set. */
  readonly openHistory?: () => InsightHistoryPort & { close(): void };
  readonly createPorts?: (client: HttpClient, lookup: (name: string) => string | undefined, options: InsightPortOptions) => readonly InsightSourcePort[];
}
export type InsightsRunOutcome = InsightRunResult & {
  /** `memory` means the database could not be opened: the run still works but nothing persists or compares. */
  readonly storage: 'sqlite' | 'memory';
};

/** Wires one internal insights run: ports (I0) + history (S3, opened and closed per run) + run flow (O1).
 * A history that cannot be opened degrades to an in-memory history instead of failing the collection. */
export async function runInsights(options: InsightsRunOptions): Promise<InsightsRunOutcome> {
  const clock = options.clock ?? (() => Date.now());
  const sourceOptions: InsightPortOptions = { ...options.sourceOptions, now: clock };
  let history: InsightHistoryPort & { close?(): void }, storage: InsightsRunOutcome['storage'] = 'sqlite';
  try { history = (options.openHistory ?? (() => openInsightsHistory(options.dataEnv)))(); }
  catch { history = new MemoryInsightHistory(); storage = 'memory'; }
  try {
    const ports = (options.createPorts ?? createInsightSourcePorts)(options.http ?? new NodeHttpClient(), name => options.env[name], sourceOptions);
    const run = await runInsightsOnce({ ports, history, now: () => new Date(clock()).toISOString(),
      ...(options.refresh && { refresh: true }), ...(options.signal && { signal: options.signal }) });
    return { ...run, storage };
  } finally { try { history.close?.(); } catch { /* close errors never change the result */ } }
}
