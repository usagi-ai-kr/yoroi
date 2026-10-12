import { type InsightHistoryPort, type InsightSuccess, insightPublicationDate, shiftInsightDate } from './history-port.js';
import type { ValidatedInsightRecord } from './validation.js';
import { buildInsightLetter, type InsightLetterResult } from './letter.js';
import type { LetterFailure, LetterSourceInput } from './letter-sections.js';
import type { InsightSource } from './record.js';
import { buildMeasurements, buildRanks, DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS, failureKind } from './run-once-steps.js';
import { buildPriceMap } from './letter-top10-price.js';
import { buildPreviousRanks } from './letter-top10-history.js';
import { collectInsightSource, type InsightSourcePort } from './source-port.js';
import { validateInsightRows } from './validation.js';
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
export interface InsightTop10Row { readonly modelId: string; readonly value?: number; readonly metric?: string; readonly rank?: number;
  readonly priceInput?: number; readonly priceOutput?: number }
export interface InsightTop10Data { readonly records: readonly InsightTop10Row[]; readonly arenaRecords: readonly InsightTop10Row[]; readonly openrouterRecords: readonly InsightTop10Row[]; readonly failedSources: readonly string[];
  readonly previousRanks: readonly { readonly modelId: string; readonly rank: number; readonly metric: string }[];
  readonly observedAt?: string; readonly nowUtc?: string }
const top10Row = (value: ValidatedInsightRecord, metric: string, prices?: { input?: number; output?: number }): InsightTop10Row =>
  ({ modelId: value.record.modelId, value: value.record.value, metric,
    ...(prices?.input !== undefined && { priceInput: prices.input }), ...(prices?.output !== undefined && { priceOutput: prices.output }) });
export interface InsightRunResult {
  /** 1-A: success and partial success 0; every source failed 1. Argument errors (2) belong to the CLI. */
  readonly exitCode: 0 | 1; readonly publicationDate: string; readonly letter: InsightLetterResult;
  readonly sources: readonly InsightSourceReport[]; readonly pruned: number;
  /** Full validated top rows for the compact top-10 letter (uncapped by evidence limits). */
  readonly top10?: InsightTop10Data;
}
type SourceRun = { readonly input: LetterSourceInput; readonly report: InsightSourceReport; readonly success?: InsightSuccess };

async function runSource(deps: InsightRunDeps, port: InsightSourcePort, publicationDate: string, observedAt: string): Promise<SourceRun> {
  const source = port.id, scope = deps.requestScopes?.[source] ?? DEFAULT_REQUEST_SCOPES[source];
  const failed = (failure: LetterFailure, reason: string): SourceRun => ({ input: { source, ok: false, failure },
    report: { source, status: 'failed', failure, reason } });
  try {
    const dailyKey = { source, publicationDate, requestScope: scope, schemaVersion: deps.schemaVersions?.[source] ?? DEFAULT_SCHEMA_VERSIONS[source] };
    let success: InsightSuccess | undefined = deps.refresh ? undefined : deps.history.getDaily(dailyKey);
    let report: InsightSourceReport = { source, status: 'reused' }, partial = false;
    if (!success) {
      const collected = await collectInsightSource(port, observedAt, deps.signal);
      if (!collected.ok) return failed(failureKind(collected.error), collected.error.code);
      const validation = validateInsightRows(source, collected.rows);
      if (!validation.ok) return failed(failureKind(undefined, validation), validation.reason);
      success = validation; partial = validation.rejectedRows > 0;
      const saved = deps.history.saveDaily({ ...dailyKey, schemaVersion: validation.records[0]!.record.schemaVersion }, validation,
        { refresh: deps.refresh === true, complete: !partial });
      report = { source, status: 'collected', rejectedRows: validation.rejectedRows, saved, ...(partial && { partial }) };
    }
    return { report, success, input: { source, ok: true, measurements: buildMeasurements(deps.history, scope, success, deps.evidenceLimit ?? 20),
      ranks: buildRanks(deps.history, scope, publicationDate, success, !partial, deps.rankGroupLimit ?? 5), ...(partial && { partial }) } };
  } catch { return failed('parse', 'internal-error'); }
}
function buildTop10Data(deps: InsightRunDeps, publicationDate: string, runs: readonly SourceRun[], observedAt: string): InsightTop10Data {
  const success = (source: InsightSource) => runs.find(r => r.report.source === source)?.success;
  const intact = (source: InsightSource) => { const run = runs.find(r => r.report.source === source);
    return run && run.report.status !== 'failed' && run.report.partial !== true && (run.report.rejectedRows ?? 0) === 0; };
  const aa = success('artificial-analysis')?.records ?? [], first = aa[0]?.record, prices = buildPriceMap(aa);
  const records = aa.filter(v => ['artificial_analysis_intelligence_index', 'artificial_analysis_coding_index', 'median_output_tokens_per_second'].includes(v.record.metric)).map(v => top10Row(v, v.record.metric, prices.get(v.record.modelId)));
  let previous: InsightSuccess | undefined;  try { previous = first && deps.history.getDaily({ source: 'artificial-analysis', publicationDate: shiftInsightDate(publicationDate, -1),
    requestScope: deps.requestScopes?.['artificial-analysis'] ?? DEFAULT_REQUEST_SCOPES['artificial-analysis'], schemaVersion: first.schemaVersion }) || undefined; } catch { previous = undefined; }
  const arenaRecords = intact('arena') ? (success('arena')?.records ?? []).filter(v => v.record.metric === 'rank').map(v => ({ modelId: v.record.modelId, rank: v.record.value, metric: 'rank' })) : [];
  const orRecords = intact('openrouter') ? (success('openrouter')?.records ?? []) : [];
  const latest = orRecords.map(v => v.comparisonDate).filter((date): date is string => date !== null).sort().at(-1) ?? null;
  const openrouterRecords = orRecords.filter(v => v.record.metric === 'total_tokens' && v.comparisonDate === latest && v.record.metadata?.aggregate !== true && v.record.modelId.trim().toLowerCase() !== 'other').map(v => top10Row(v, 'total_tokens'));
  const prev = buildPreviousRanks(deps.history, publicationDate, previous, DEFAULT_REQUEST_SCOPES['openrouter'],
    success('openrouter')?.records[0]?.record.schemaVersion, openrouterRecords.length > 0);
  return { records, arenaRecords, openrouterRecords, previousRanks: prev.ranks, failedSources: runs.filter(r => r.report.status === 'failed').map(r => r.report.source),
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
