import type { InsightDailyKey, InsightHistoryPort, InsightSuccess } from './history-port.js';
import type { LetterFailure, LetterSourceInput } from './letter-sections.js';
import { buildMeasurements, buildRanks, DEFAULT_REQUEST_SCOPES, DEFAULT_SCHEMA_VERSIONS, failureKind } from './run-once-steps.js';
import { collectInsightSource, type InsightSourcePort } from './source-port.js';
import { validateInsightRows } from './validation.js';
import type { InsightRunDeps, InsightSourceReport } from './run-once.js';

const TRANSIENT_CODES = new Set(['timeout', 'network', 'unavailable']);

export type SourceRun = { readonly input: LetterSourceInput; readonly report: InsightSourceReport; readonly success?: InsightSuccess };
/** 렌더는 저장본만 사용한다. 행 일부 거절은 저장·재조회 후 partial로 표시하며 재수집하고, 일시 수집 실패 시 기존 partial 저장본을 fallback으로 쓴다. */
export async function runSource(deps: InsightRunDeps, port: InsightSourcePort, publicationDate: string, observedAt: string): Promise<SourceRun> {
  const source = port.id, scope = deps.requestScopes?.[source] ?? DEFAULT_REQUEST_SCOPES[source];
  const history = deps.history as InsightHistoryPort & {
    getDaily(key: InsightDailyKey, options?: { readonly includePartial?: boolean }): InsightSuccess | undefined };
  const failed = (failure: LetterFailure, reason: string): SourceRun => ({ input: { source, ok: false, failure },
    report: { source, status: 'failed', failure, reason } });
  try {
    const dailyKey = { source, publicationDate, requestScope: scope, schemaVersion: deps.schemaVersions?.[source] ?? DEFAULT_SCHEMA_VERSIONS[source] };
    let success: InsightSuccess | undefined = deps.refresh ? undefined : deps.history.getDaily(dailyKey);
    if (success?.rejectedRows) success = undefined; // partial은 완료 캐시로 재사용하지 않는다
    let report: InsightSourceReport = { source, status: 'reused' }, partial = false;
    if (!success) {
      const collected = await collectInsightSource(port, observedAt, deps.signal);
      if (!collected.ok) {
        if (!TRANSIENT_CODES.has(collected.error.code)) return failed(failureKind(collected.error), collected.error.code);
        success = history.getDaily(dailyKey, { includePartial: true });
        if (!success?.records.length || !success.rejectedRows) return failed(failureKind(collected.error), collected.error.code);
        report = { source, status: 'reused', partial: true, rejectedRows: success.rejectedRows, reason: collected.error.code };
      } else {
        const validation = validateInsightRows(source, collected.rows);
        if (!validation.ok) return failed(failureKind(undefined, validation), validation.reason);
        partial = validation.rejectedRows > 0;
        const schemaVersion = validation.records[0]!.record.schemaVersion;
        const saved = deps.history.saveDaily({ ...dailyKey, schemaVersion }, validation,
          { refresh: deps.refresh === true, complete: !partial });
        success = history.getDaily({ ...dailyKey, schemaVersion }, { includePartial: true });
        if (!success) return failed('parse', saved ? 'stored-read-missing' : 'stored-write-skipped');
        report = { source, status: 'collected', saved };
      }
    }
    partial = (success.rejectedRows ?? 0) > 0 || report.partial === true;
    report = { ...report, rejectedRows: success.rejectedRows, ...(partial && { partial }) };
    return { report, success, input: { source, ok: true, measurements: buildMeasurements(deps.history, scope, success, deps.evidenceLimit ?? 20),
      ranks: buildRanks(deps.history, scope, publicationDate, success, !partial, deps.rankGroupLimit ?? 5), ...(partial && { partial }) } };
  } catch { return failed('parse', 'internal-error'); }
}
