import type { InsightSuccess, RejectionDiagnostics } from './history-port.js';
import { sanitizeAaReject } from './aa-reject-reasons.js';

/** 단계B 상한: 초과 시 잘라내지 않고 키 전체를 생략한다. */
export const MAX_DIAGNOSTIC_REASONS = 8, MAX_DIAGNOSTIC_FIELDS = 24, MAX_DIAGNOSTIC_JSON_BYTES = 2048;

const codeAllowed = (code: string): boolean => sanitizeAaReject({ code, fields: [] }).code === code;
const fieldAllowed = (field: string): boolean =>
  sanitizeAaReject({ code: 'other', fields: [field] }).fields.includes(field);
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function bounded(counts: Readonly<Record<string, number>> | undefined, allowed: (key: string) => boolean,
  limit: number): Readonly<Record<string, number>> | undefined {
  if (counts === undefined) return undefined;
  const entries = Object.entries(counts).filter(([key, value]) => allowed(key) && isCount(value)).slice(0, limit);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/** 단계B 공유 serializer: artificial-analysis·rejectedRows>0에서만, 단계A allowlist 이름과 양의 safe integer
 *  건수만 담는다(reasons≤8·fields≤24·UTF-8 JSON≤2KiB, 초과·빈 집계는 키 전체 생략, 원문·모델값 미포함). */
export function buildRejectionDiagnostics(result: InsightSuccess): RejectionDiagnostics | undefined {
  if (result.source !== 'artificial-analysis' || result.rejectedRows <= 0) return undefined;
  const reasons = bounded(result.rejectedReasons, codeAllowed, MAX_DIAGNOSTIC_REASONS);
  const fields = bounded(result.rejectedFields, fieldAllowed, MAX_DIAGNOSTIC_FIELDS);
  if (reasons === undefined && fields === undefined) return undefined;
  const diagnostics: RejectionDiagnostics = { ...(reasons && { reasons }), ...(fields && { fields }) };
  return new TextEncoder().encode(JSON.stringify(diagnostics)).length <= MAX_DIAGNOSTIC_JSON_BYTES
    ? diagnostics : undefined;
}
