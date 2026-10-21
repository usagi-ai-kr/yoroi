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
import { buildOfficialFreeCatalog, collectOfficialFreeListing, collectOpenCodeFreeModels, type RuntimeFreePlan } from '../insights/opencode-free-models.js';
import { runOnceDiscovery, type OnceDiscoveryNotice, type OnceDiscoveryOptions } from '../insights/model-discovery-once.js';
import { freeReviewerFor } from './insights-free-reviewer.js';
import { FileModelRegistrySnapshotStore } from '../insights/model-discovery-file-store.js';
import { resolveDiscoveryBaseDir } from '../insights/model-discovery-config.js';
import { activeLetterModelLists, type LetterModelLists } from '../insights/letter-model-lists.js';
import type { ThreeRolePipelineInput, ThreeRolePipelineOutput } from '../insights/letter-three-role-pipeline.js';
import { buildThreeRole } from './insights-three-role.js';
import { letterThreeRoleConfig } from '../config/letter-three-role.js';

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

/** #168 수집 배선: lists discovery.collect 명시 true일 때만 공식 CLI 경로로 수집·persist한다.
 *  그 외에는 undefined(네트워크·저장소 접근 없음). 명시 options.discovery가 있으면 그게 우선한다. */
export function discoveryOptionsFrom(runner: ProcessRunner | undefined, env: Readonly<Record<string, string | undefined>>,
  target: 'v1' | 'v2', signal?: AbortSignal, lists: LetterModelLists = activeLetterModelLists()): OnceDiscoveryOptions | undefined {
  if (!runner || lists.discovery?.collect !== true) return undefined;
  return { ...(signal !== undefined && { signal }), config: { enabled: true, providers: ['opencode'] },
    store: new FileModelRegistrySnapshotStore(resolveDiscoveryBaseDir({ env: env as NodeJS.ProcessEnv })),
    runCommand: async (cmd, args) => {
      const out = await runner.run({ executable: cmd, args: target === 'v2' ? [...args, '--standalone'] : args,
        timeoutMs: 60_000, envMode: 'merge' }, signal);
      if (out.exitCode !== 0) throw new Error(`discovery command failed: ${cmd} (exit ${out.exitCode})`);
      return out.stdout;
    } };
}

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
    // #196: free 판정 권위는 공식 페이지(명시적 Free 표기)다. CLI 관측은 보조 근거(미검증)이며,
    // 공식 조회는 CLI 관측 경로(processRunner 존재)에서만 수행한다(조회 실패도 발행을 막지 않는다).
    const official = options.processRunner ? await collectOfficialFreeListing(options.http ?? new NodeHttpClient(), { ...(options.signal && { signal: options.signal }) }) : undefined;
    const freeCatalog = official ? buildOfficialFreeCatalog(freeModels ?? [], run.publicationDate, official.listing) : undefined;
    const freeNote = official === undefined ? undefined : official.pageFailed
      ? `Free 목록 출처: 공식 페이지 조회 실패 → last-good 공식 스냅샷(${official.listing.checkedOn}) 사용` : `Free 목록 출처: 공식 페이지 Free 표기 확인(${official.listing.status}, ${official.listing.checkedOn})` + `${official.apiFailed ? ' · 공개 모델 API 조회 실패(무료 판정에는 미사용)' : ''}`;
    const base = run.top10 ? { ...run.top10, ...(freeCatalog && { freeCatalog: freeCatalog.plans }), ...(freeNote !== undefined && { warnings: [...(run.top10.warnings ?? []), freeNote] }) } : run.top10;
    const discoveryNotice = await runOnceDiscovery(options.discovery ??
      discoveryOptionsFrom(options.processRunner, options.env, target, options.signal)); // 기본 꺼짐·실패 무해(#168)
    // #194: 3역할 ranked 계산에 본문 렌더와 같은 enriched top10(freeCatalog·warnings)을 넘긴다. 기본 꺼짐(#195)
    const threeRole = buildThreeRole(options.threeRole, base ? { ...run, top10: base } : run, letterThreeRoleConfig(options.env));
    // #194 D: 3역할 활성 때만 Free 표 리뷰어 근거를 실어 보낸다(비활성은 undefined → 2역할 출력 유지).
    const freeCat = freeCatalog ? { freeCatalog: freeCatalog.plans } : undefined;
    const freeReviewer = freeReviewerFor(threeRole, freeCat);
    const top10 = base ? { ...base, ...(freeReviewer !== undefined && { freeReviewer }) } : base;
    return { ...run, ...(top10 && { top10 }), ...(discoveryNotice && { discoveryNotice }), ...(threeRole && { threeRole }), storage };
  } finally { try { history.close?.(); } catch { /* close errors never change the result */ } }
}
