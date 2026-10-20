import type { InsightHistoryPort } from '../insights/history-port.js';
import { MemoryInsightHistory } from '../insights/history-memory.js';
import { runInsightsOnce, type InsightRunResult } from '../insights/run-once.js';
import type { InsightSourcePort } from '../insights/source-port.js';
import { createInsightSourcePorts, type InsightPortOptions } from '../insights/sources.js';
import { NodeHttpClient, type HttpClient } from '../infra/http-client.js';
import { NodeProcessRunner } from '../infra/process-runner.js';
import type { ProcessRunner } from '../infra/process-port.js';
import { openInsightsHistory } from '../infra/sqlite/insights-store.js';
import { opencodeTarget } from '../config/load-config.js';
import { buildFreeCatalog, collectOpenCodeFreeModels, type RuntimeFreePlan } from '../insights/opencode-free-models.js';
import { runOnceDiscovery, type OnceDiscoveryNotice, type OnceDiscoveryOptions } from '../insights/model-discovery-once.js';
import { runThreeRolePipeline, type ThreeRolePipelineInput, type ThreeRolePipelineOutput } from '../insights/letter-three-role-pipeline.js';

export interface InsightsRunOptions {
  /** Provider/key environment (AA and OpenRouter keys come from the usual .env/process env; values are never logged). */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Data-dir environment (YOROI_DATA_DIR etc.), like `once`. */
  readonly dataEnv: NodeJS.ProcessEnv;
  readonly http?: HttpClient;
  /** Runtime `opencode models` discovery. The CLI supplies the real runner; tests can inject a stub. */
  readonly processRunner?: ProcessRunner;
  /** Epoch ms clock; the KST publication day and all timestamps derive from it. */
  readonly clock?: () => number;
  readonly refresh?: boolean;
  readonly signal?: AbortSignal;
  /** Request policy hooks (sleep/policy) for the source ports. */
  readonly sourceOptions?: Omit<InsightPortOptions, 'now'>;
  /** Test hooks: replace the SQLite history or the whole port set. */
  readonly openHistory?: () => InsightHistoryPort & { close(): void };
  readonly createPorts?: (client: HttpClient, lookup: (name: string) => string | undefined, options: InsightPortOptions) => readonly InsightSourcePort[];
  /** #168 모델 감지(기본 꺼짐): config.enabled가 true일 때만 수집 뒤 실행한다. 실패해도 once는 실패하지 않는다. */
  readonly discovery?: OnceDiscoveryOptions;
  /** #195 3역할 파이프라인(기본 꺼짐): true이거나 설정 객체일 때만 수집 뒤 실행한다. */
  readonly threeRole?: boolean | ThreeRolePipelineInput;
}
type InsightsTop10Data = NonNullable<InsightRunResult['top10']> & {
  readonly freeCatalog?: readonly RuntimeFreePlan[];
};
export type InsightsRunOutcome = Omit<InsightRunResult, 'top10'> & { readonly top10?: InsightsTop10Data } & {
  /** `memory` means the database could not be opened: the run still works but nothing persists or compares. */
  readonly storage: 'sqlite' | 'memory';
  readonly discoveryNotice?: OnceDiscoveryNotice;
  readonly threeRole?: ThreeRolePipelineOutput;
};

const buildThreeRole = (opt?: boolean | ThreeRolePipelineInput, run?: InsightRunResult): ThreeRolePipelineOutput | undefined => {
  if (!opt || (typeof opt === 'object' && opt.options?.enabled === false)) return undefined;
  const isObj = typeof opt === 'object', recs = run?.top10?.records;
  const toCand = (r: { modelId: string; value?: number }) => ({ modelId: r.modelId, ...(typeof r.value === 'number' && { score: r.value }) });
  const o = isObj && opt.orchestrator ? opt.orchestrator : (recs?.map(toCand) ?? []);
  const w = isObj && opt.worker ? opt.worker : o;
  const r = isObj && opt.reviewer ? opt.reviewer : o;
  return runThreeRolePipeline({ orchestrator: o, reviewer: r, worker: w,
    options: { enabled: true, ...(run?.publicationDate !== undefined && { publicationDate: run.publicationDate }), ...(isObj ? opt.options : {}) } });
};

/** Wires one internal insights run: ports (I0) + history (S3, opened and closed per run) + run flow (O1).
 * A history that cannot be opened degrades to an in-memory history instead of failing the collection. */
export async function runInsights(options: InsightsRunOptions): Promise<InsightsRunOutcome> {
  const clock = options.clock ?? (() => Date.now());
  const target = opencodeTarget(options.env); // 수집 시작 전에 판정(도중 throw로 history가 먼저 닫히지 않게)
  const sourceOptions: InsightPortOptions = { ...options.sourceOptions, now: clock };
  let history: InsightHistoryPort & { close?(): void }, storage: InsightsRunOutcome['storage'] = 'sqlite';
  try { history = (options.openHistory ?? (() => openInsightsHistory(options.dataEnv)))(); }
  catch { history = new MemoryInsightHistory(); storage = 'memory'; }
  try {
    const ports = (options.createPorts ?? createInsightSourcePorts)(options.http ?? new NodeHttpClient(), name => options.env[name], sourceOptions);
    const [run, freeModels] = await Promise.all([runInsightsOnce({ ports, history, now: () => new Date(clock()).toISOString(),
      ...(options.refresh && { refresh: true }), ...(options.signal && { signal: options.signal }) }),
      options.processRunner ? collectOpenCodeFreeModels(options.processRunner,
        { ...(options.signal && { signal: options.signal }), target }) : Promise.resolve(undefined)]);
    const freeCatalog = freeModels && buildFreeCatalog(freeModels, run.publicationDate);
    const top10 = run.top10 ? { ...run.top10, ...(freeCatalog && { freeCatalog }) } : run.top10;
    const discoveryNotice = await runOnceDiscovery(options.discovery); // 기본 꺼짐·실패 무해(#168)
    const threeRole = buildThreeRole(options.threeRole, run); // 기본 꺼짐(#195)
    return { ...run, ...(top10 && { top10 }), ...(discoveryNotice && { discoveryNotice }), ...(threeRole && { threeRole }), storage };
  } finally { try { history.close?.(); } catch { /* close errors never change the result */ } }
}
