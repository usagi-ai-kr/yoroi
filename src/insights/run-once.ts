import { type InsightHistoryPort, type InsightSuccess, insightPublicationDate, shiftInsightDate } from './history-port.js';
import type { ValidatedInsightRecord } from './validation.js';
import { buildInsightLetter, type InsightLetterResult } from './letter.js';
import type { LetterFailure } from './letter-sections.js';
import type { InsightSource } from './record.js';
import { DEFAULT_REQUEST_SCOPES } from './run-once-steps.js';
import { runSource, type SourceRun } from './run-source-stored.js';
import type { ModelPrices } from './letter-top10-price.js';
import { withSuccessors } from './letter-top10-candidates.js';
import { buildAaTop10Inputs, buildPreviousRanks, previousOpenCodeDataTop10Records } from './letter-top10-history.js'; import { loadEffortAvailability, type EffortAvailability } from './letter-effort-availability.js';
import { getDailyWithLegacyFallback, LEGACY_REQUEST_SCOPES } from './legacy-scopes.js';
import { buildCognitionTop10Records, buildPreviousCognitionTop10Records } from './cognition-top10.js';
import type { InsightSourcePort } from './source-port.js'; import { arenaEvidenceOutcome } from './letter-arena-evidence.js';
export interface InsightRunDeps {
  readonly ports: readonly InsightSourcePort[];
  readonly history: InsightHistoryPort;
  /** UTC ISO timestamp ending in Z. Collection time and issue time both come from it. */
  readonly now: () => string;
  /** Replace today's stored success (--refresh) instead of reusing it. */
  readonly refresh?: boolean;
  readonly signal?: AbortSignal;
  readonly requestScopes?: Partial<Record<InsightSource, string>>;
  readonly schemaVersions?: Partial<Record<InsightSource, string>>;
  /** Evidence rows and rank groups kept per source in the letter (default 20 and 5). */
  readonly evidenceLimit?: number;
  readonly rankGroupLimit?: number;
}
export interface InsightSourceReport {
  readonly source: InsightSource; readonly status: 'collected' | 'reused' | 'failed';
  /** Diagnostic code only (SourceError code or validation reason); never record contents. */
  readonly reason?: string; readonly failure?: LetterFailure;
  readonly rejectedRows?: number; readonly partial?: boolean; readonly saved?: boolean;
}
export interface InsightTop10Row { readonly modelId: string; readonly modelAlias?: string; readonly value?: number; readonly metric?: string; readonly rank?: number; readonly priceInput?: number; readonly priceOutput?: number; readonly releaseDate?: string }
export interface InsightTop10Data { readonly records: readonly InsightTop10Row[]; readonly openrouterRecords: readonly InsightTop10Row[]; readonly failedSources: readonly string[];
  readonly opencodeDataRecords?: readonly InsightTop10Row[]; readonly cognitionRecords?: readonly InsightTop10Row[];
  readonly previousRanks: readonly { readonly modelId: string; readonly rank: number; readonly metric: string }[];
  readonly warnings?: readonly string[]; readonly observedAt?: string; readonly nowUtc?: string;
  /** #188: 현재·전일 순위가 같은 스냅샷을 쓰는지 검증 가능한 가용성 프로필. */
  readonly effortAvailability?: EffortAvailability }
const top10Row = (value: ValidatedInsightRecord, metric: string, prices?: ModelPrices): InsightTop10Row =>
  ({ modelId: value.record.modelId, ...(value.record.modelAlias && { modelAlias: value.record.modelAlias }), value: value.record.value, metric,
    ...(prices?.input !== undefined && { priceInput: prices.input }), ...(prices?.output !== undefined && { priceOutput: prices.output }),
    ...(typeof value.record.metadata?.successorOf === 'string' && { successorOf: value.record.metadata.successorOf }),
    ...(typeof value.record.metadata?.releaseDate === 'string' && { releaseDate: value.record.metadata.releaseDate }) });
export interface InsightRunResult {
  /** 1-A: success and partial success 0; every source failed 1. Argument errors (2) belong to the CLI. */
  readonly exitCode: 0 | 1; readonly publicationDate: string; readonly letter: InsightLetterResult;
  readonly sources: readonly InsightSourceReport[]; readonly pruned: number;
  /** Full validated top rows for the compact top-10 letter (uncapped by evidence limits). */ readonly top10?: InsightTop10Data;
}
/** 집계 행(OpenRouter `other`·OpenCode Data `Other`)은 모델이 아니므로 근거 행에서 뺀다. */
const isAggregateRow = (v: ValidatedInsightRecord): boolean => v.record.metadata?.aggregate === true || v.record.modelId.trim().toLowerCase() === 'other';
function buildTop10Data(deps: InsightRunDeps, publicationDate: string, runs: readonly SourceRun[], observedAt: string): InsightTop10Data {
  const success = (source: InsightSource) => runs.find(r => r.report.source === source)?.success;
  const intact = (source: InsightSource) => { const run = runs.find(r => r.report.source === source);
    return run && run.report.status !== 'failed' && run.report.partial !== true && (run.report.rejectedRows ?? 0) === 0; };
  const aa = withSuccessors(success('artificial-analysis')?.records ?? []);
  const first = aa[0]?.record, records = buildAaTop10Inputs(aa);
  let previous: InsightSuccess | undefined;  try {
    const k = { source: 'artificial-analysis' as const, publicationDate: shiftInsightDate(publicationDate, -1),
      requestScope: deps.requestScopes?.['artificial-analysis'] ?? DEFAULT_REQUEST_SCOPES['artificial-analysis'], schemaVersion: first!.schemaVersion };
    const h = deps.history as { getDaily(key: typeof k, o?: { readonly includePartial?: boolean }): InsightSuccess | undefined };
    previous = (first && (h.getDaily(k, { includePartial: true }) ??
      LEGACY_REQUEST_SCOPES['artificial-analysis']?.map(s => h.getDaily({ ...k, requestScope: s }, { includePartial: true })).find(Boolean) ??
      getDailyWithLegacyFallback(deps.history, k))) || undefined; } catch { previous = undefined; }
  const orRecords = intact('openrouter') ? (success('openrouter')?.records ?? []) : [];
  const latest = orRecords.map(v => v.comparisonDate).filter((date): date is string => date !== null).sort().at(-1) ?? null;
  const openrouterRecords = orRecords.filter(v => v.record.metric === 'total_tokens' && v.comparisonDate === latest && !isAggregateRow(v)).map(v => top10Row(v, 'total_tokens'));
  const ocRows = intact('opencode-data') ? (success('opencode-data')?.records ?? []) : [];
  const ocLatest = ocRows.map(v => v.comparisonDate).filter((date): date is string => date !== null).sort().at(-1) ?? null;
  const opencodeDataRecords = ocLatest === null ? [] : ocRows.filter(v => v.record.metric === 'opencode_data_tokens' && v.comparisonDate === ocLatest && !isAggregateRow(v)).map(v => top10Row(v, 'opencode_data_tokens'));
  const orScope = deps.requestScopes?.['openrouter'] ?? DEFAULT_REQUEST_SCOPES['openrouter'];
  const prevOc = ocRows[0] ? previousOpenCodeDataTop10Records(deps.history, publicationDate, deps.requestScopes?.['opencode-data'] ?? DEFAULT_REQUEST_SCOPES['opencode-data'], ocRows[0].record.schemaVersion) : [];
  const cognitionRows = intact('cognition') ? success('cognition')?.records ?? [] : [];
  const cognitionRecords = buildCognitionTop10Records(cognitionRows);
  const arenaOutcome = arenaEvidenceOutcome(intact('arena-coding') ? success('arena-coding')?.records ?? [] : []); // #190: 추가 근거 전용(점수 미반영·부분 수집 미사용)
  const cognitionFirst = cognitionRows[0]?.record, previousCognitionRecords = cognitionFirst ? buildPreviousCognitionTop10Records(deps.history, publicationDate, deps.requestScopes?.cognition ?? DEFAULT_REQUEST_SCOPES.cognition, cognitionFirst.schemaVersion) : [];
  const coverage = { aaOrchestrator: records.some(r => r.metric === 'artificial_analysis_intelligence_index'), aaWorker: records.some(r => r.metric === 'artificial_analysis_coding_index'), cognition: cognitionRecords.length > 0, openrouter: openrouterRecords.length > 0, opencodeData: opencodeDataRecords.length > 0 };
  // #188: 프로필 스냅샷을 한 번만 읽어 전일 순위 계산과 결과 데이터가 같은 프로필을 쓰게 한다.
  const effortAvailability = loadEffortAvailability();
  const prev = buildPreviousRanks(deps.history, publicationDate, previous, orScope, success('openrouter')?.records[0]?.record.schemaVersion,
    openrouterRecords.length > 0, prevOc, previousCognitionRecords, coverage, effortAvailability);
  return { records, openrouterRecords, previousRanks: prev.ranks, failedSources: runs.filter(r => r.report.status === 'failed').map(r => r.report.source),
    ...(opencodeDataRecords.length > 0 && { opencodeDataRecords }), ...(cognitionRecords.length > 0 && { cognitionRecords }),
    observedAt, nowUtc: observedAt, ...(effortAvailability && { effortAvailability }),
    ...((prev.warnings.length > 0 || arenaOutcome.note !== undefined) && { warnings: [...prev.warnings, ...(arenaOutcome.note ? [arenaOutcome.note] : [])] }) };
}
/** One internal-only run: collect/reuse → validate → store → compare → letter. No rendering, delivery or LLM. */
export async function runInsightsOnce(deps: InsightRunDeps): Promise<InsightRunResult> {
  const observedAt = deps.now(), publicationDate = insightPublicationDate(observedAt);
  const runs = await Promise.all(deps.ports.map(port => runSource(deps, port, publicationDate, observedAt)));
  let letter: InsightLetterResult;
  try { letter = buildInsightLetter(runs.map(run => run.input), deps.now()); }
  catch { letter = { ok: false, reason: '전체 소스 실패', failedSources: runs.map(run => run.report.source) }; }
  let pruned = 0;
  try { pruned = deps.history.prune(publicationDate); } catch { /* retention is best effort */ }
  return { exitCode: letter.ok ? 0 : 1, publicationDate, letter, sources: runs.map(run => run.report), pruned,
    top10: buildTop10Data(deps, publicationDate, runs, observedAt) };
}
