import { type InsightHistoryPort, type InsightSuccess, insightPublicationDate, shiftInsightDate } from './history-port.js';
import type { ValidatedInsightRecord } from './validation.js';
import { buildInsightLetter, type InsightLetterResult } from './letter.js';
import type { LetterFailure } from './letter-sections.js';
import type { InsightSource } from './record.js';
import { DEFAULT_REQUEST_SCOPES } from './run-once-steps.js';
import { runSource, type SourceRun } from './run-source-stored.js';
import { buildPriceMap, type ModelPrices } from './letter-top10-price.js';
import { withSuccessors } from './letter-top10-candidates.js';
import { buildPreviousRanks } from './letter-top10-history.js';
import { getDailyWithLegacyFallback } from './legacy-scopes.js';
import type { InsightSourcePort } from './source-port.js';
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
export interface InsightTop10Row { readonly modelId: string; readonly modelAlias?: string; readonly value?: number; readonly metric?: string; readonly rank?: number;
  readonly priceInput?: number; readonly priceOutput?: number; readonly releaseDate?: string }
export interface InsightTop10Data { readonly records: readonly InsightTop10Row[]; readonly openrouterRecords: readonly InsightTop10Row[]; readonly failedSources: readonly string[];
  readonly opencodeDataRecords?: readonly InsightTop10Row[];
  readonly previousRanks: readonly { readonly modelId: string; readonly rank: number; readonly metric: string }[];
  readonly warnings?: readonly string[];
  readonly observedAt?: string; readonly nowUtc?: string }
const top10Row = (value: ValidatedInsightRecord, metric: string, prices?: ModelPrices): InsightTop10Row =>
  ({ modelId: value.record.modelId, ...(value.record.modelAlias && { modelAlias: value.record.modelAlias }), value: value.record.value, metric,
    ...(prices?.input !== undefined && { priceInput: prices.input }), ...(prices?.output !== undefined && { priceOutput: prices.output }),
    ...(typeof value.record.metadata?.successorOf === 'string' && { successorOf: value.record.metadata.successorOf }),
    ...(typeof value.record.metadata?.releaseDate === 'string' && { releaseDate: value.record.metadata.releaseDate }) });
export interface InsightRunResult {
  /** 1-A: success and partial success 0; every source failed 1. Argument errors (2) belong to the CLI. */
  readonly exitCode: 0 | 1; readonly publicationDate: string; readonly letter: InsightLetterResult;
  readonly sources: readonly InsightSourceReport[]; readonly pruned: number;
  /** Full validated top rows for the compact top-10 letter (uncapped by evidence limits). */
  readonly top10?: InsightTop10Data;
}
/** 집계 행(OpenRouter `other`·OpenCode Data `Other`)은 모델이 아니므로 근거 행에서 뺀다. */
const isAggregateRow = (v: ValidatedInsightRecord): boolean => v.record.metadata?.aggregate === true || v.record.modelId.trim().toLowerCase() === 'other';
function buildTop10Data(deps: InsightRunDeps, publicationDate: string, runs: readonly SourceRun[], observedAt: string): InsightTop10Data {
  const success = (source: InsightSource) => runs.find(r => r.report.source === source)?.success;
  const intact = (source: InsightSource) => { const run = runs.find(r => r.report.source === source);
    return run && run.report.status !== 'failed' && run.report.partial !== true && (run.report.rejectedRows ?? 0) === 0; };
  const aa = withSuccessors(success('artificial-analysis')?.records ?? []);
  const first = aa[0]?.record, prices = buildPriceMap(aa);
  const records = aa.filter(v => ['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index', 'median_output_tokens_per_second', 'intelligence_index_cost_per_task'].includes(v.record.metric)).map(v => top10Row(v, v.record.metric, prices.get(v.record.modelId)));
  let previous: InsightSuccess | undefined;  try { previous = first && getDailyWithLegacyFallback(deps.history, { source: 'artificial-analysis',
    publicationDate: shiftInsightDate(publicationDate, -1),
    requestScope: deps.requestScopes?.['artificial-analysis'] ?? DEFAULT_REQUEST_SCOPES['artificial-analysis'],
    schemaVersion: first.schemaVersion }) || undefined; } catch { previous = undefined; }
  const orRecords = intact('openrouter') ? (success('openrouter')?.records ?? []) : [];
  const latest = orRecords.map(v => v.comparisonDate).filter((date): date is string => date !== null).sort().at(-1) ?? null;
  const openrouterRecords = orRecords.filter(v => v.record.metric === 'total_tokens' && v.comparisonDate === latest && !isAggregateRow(v)).map(v => top10Row(v, 'total_tokens'));
  const ocRows = intact('opencode-data') ? (success('opencode-data')?.records ?? []) : [];
  const ocLatest = ocRows.map(v => v.comparisonDate).filter((date): date is string => date !== null).sort().at(-1) ?? null;
  const opencodeDataRecords = ocLatest === null ? [] : ocRows.filter(v => v.record.metric === 'opencode_data_tokens' && v.comparisonDate === ocLatest && !isAggregateRow(v))
    .map(v => top10Row(v, 'opencode_data_tokens'));
  const orScope = deps.requestScopes?.['openrouter'] ?? DEFAULT_REQUEST_SCOPES['openrouter'];
  const ocPrevDate = ocRows.map(v => v.comparisonDate).filter((d): d is string => d !== null && ocLatest !== null && d < ocLatest).sort().at(-1);
  const prevOc = ocRows.filter(v => v.record.metric === 'opencode_data_tokens' && v.comparisonDate === ocPrevDate && !isAggregateRow(v)).map(v => top10Row(v, 'opencode_data_tokens'));
  const prev = buildPreviousRanks(deps.history, publicationDate, previous, orScope,
    success('openrouter')?.records[0]?.record.schemaVersion, openrouterRecords.length > 0, prevOc);
  return { records, openrouterRecords, previousRanks: prev.ranks, failedSources: runs.filter(r => r.report.status === 'failed').map(r => r.report.source),
    ...(opencodeDataRecords.length > 0 && { opencodeDataRecords }),
    observedAt, nowUtc: observedAt, ...(prev.warnings.length && { warnings: prev.warnings }) };
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
