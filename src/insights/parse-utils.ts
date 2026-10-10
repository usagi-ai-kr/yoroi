import type { InsightRecord } from './record.js';

/** Shared shape for per-row parser results (success keeps records, failure keeps a reason). */
export type ParseRowResult = { readonly ok: true; readonly index: number;
  readonly records: readonly InsightRecord[]; readonly warnings: readonly string[] } |
  { readonly ok: false; readonly index: number; readonly reason: string; readonly warnings: readonly string[] };

export const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export const isText = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** ISO calendar date that round-trips through Date.parse (rejects 2026-02-30 etc.). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}
export const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && isIsoDate(value.slice(0, 10)) &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

/** Counts keys not in `allowed` and returns one opaque warning (never the values). */
export function unknownFields(row: Record<string, unknown>, allowed: readonly string[], path: string): string[] {
  const count = Object.keys(row).filter(key => !allowed.includes(key)).length;
  return count ? [`Ignored ${count} unknown fields at ${path}`] : [];
}
