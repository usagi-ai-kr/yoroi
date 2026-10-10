import { SourceError } from '../app/usage-source.js';
import type { InsightSource } from './record.js';
import type { ParseRowResult } from './parse-utils.js';

/** 0.4.0 collection-layer port (#70): fetch one raw payload, then parse it into rows.
 * Adapters own transport and credentials; this layer owns shape and error mapping. */
export interface InsightSourcePort {
  readonly id: InsightSource;
  /** Raw provider payload. Never logs body, headers or credentials. */
  fetch(signal?: AbortSignal): Promise<unknown>;
  /** Per-row results; row failures are returned, response-shape failures may throw. */
  parse(payload: unknown, observedAt: string): readonly ParseRowResult[];
}

export type InsightCollectResult =
  { readonly ok: true; readonly id: InsightSource; readonly observedAt: string;
    readonly rows: readonly ParseRowResult[] } |
  { readonly ok: false; readonly id: InsightSource; readonly observedAt: string;
    readonly error: SourceError };

/** fetch+parse in one step. SourceError outcomes (transport or parse) are returned,
 * not thrown, so one failing source never aborts a multi-source run. */
export async function collectInsightSource(port: InsightSourcePort, observedAt: string,
  signal?: AbortSignal): Promise<InsightCollectResult> {
  try {
    const rows = port.parse(await port.fetch(signal), observedAt);
    return { ok: true, id: port.id, observedAt, rows };
  } catch (error) {
    if (error instanceof SourceError) return { ok: false, id: port.id, observedAt, error };
    return { ok: false, id: port.id, observedAt, error: new SourceError('parse') };
  }
}
