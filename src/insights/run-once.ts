import { type InsightHistoryPort, type InsightSuccess, insightPublicationDate } from './history-port.js';
import { buildInsightLetter, type InsightLetterResult } from './letter.js';
import type { LetterFailure, LetterSourceInput } from './letter-sections.js';
import type { InsightSource } from './record.js';
import { buildMeasurements, buildRanks, DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS, failureKind } from './run-once-steps.js';
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
export interface InsightRunResult {
  /** 1-A: success and partial success 0; every source failed 1. Argument errors (2) belong to the CLI. */
  readonly exitCode: 0 | 1; readonly publicationDate: string; readonly letter: InsightLetterResult;
  readonly sources: readonly InsightSourceReport[]; readonly pruned: number;
}
type SourceRun = { readonly input: LetterSourceInput; readonly report: InsightSourceReport };

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
    return { report, input: { source, ok: true, measurements: buildMeasurements(deps.history, scope, success, deps.evidenceLimit ?? 20),
      ranks: buildRanks(deps.history, scope, publicationDate, success, !partial, deps.rankGroupLimit ?? 5), ...(partial && { partial }) } };
  } catch { return failed('parse', 'internal-error'); }
}

/** One internal-only run: collect (or reuse today's success) → validate → store → compare → letter. No rendering,
 * delivery or LLM here. Failed or incomplete sources never overwrite a stored success and are retried on the next run
 * of the same day. Old history is pruned best-effort after the letter is built. */
export async function runInsightsOnce(deps: InsightRunDeps): Promise<InsightRunResult> {
  const observedAt = deps.now(), publicationDate = insightPublicationDate(observedAt);
  const runs = await Promise.all(deps.ports.map(port => runSource(deps, port, publicationDate, observedAt)));
  let letter: InsightLetterResult;
  try { letter = buildInsightLetter(runs.map(run => run.input), deps.now()); }
  catch { letter = { ok: false, reason: '전체 소스 실패', failedSources: runs.map(run => run.report.source) }; }
  let pruned = 0;
  try { pruned = deps.history.prune(publicationDate); } catch { /* retention is best effort */ }
  return { exitCode: letter.ok ? 0 : 1, publicationDate, letter, sources: runs.map(run => run.report), pruned };
}
