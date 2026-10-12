import type { InsightMetadataValue, InsightRecord, InsightSource } from './record.js';

/** One raw provider row before parsing: parser input is untrusted JSON, never typed. */
export type InsightRow = Readonly<Record<string, unknown>>;

/** Measurement kinds the current parsers emit. Unknown units stay open via `string`. */
export type BenchmarkMetric =
  | 'rating' | 'rating_lower' | 'rating_upper' | 'variance' | 'vote_count' | 'rank'
  | 'score' | 'score_ci_lower' | 'score_ci_upper' | 'observation_count' | 'session_count'
  | 'total_tokens' | 'count' | 'ratio' | 'steps' | 'tool_calls' | 'flagged_rate'
  | (string & {});

/** A parsed record reduced to the fields every source can supply. */
export interface NormalizedBenchmarkRecord {
  readonly source: InsightSource;
  readonly modelId: string;
  readonly metric: BenchmarkMetric;
  readonly value: number;
  readonly unit: string;
  readonly category: string;
  readonly observedAt: string;
  readonly sourceAsOf: string;
  readonly license: string | null;
  readonly metadata?: Readonly<Record<string, InsightMetadataValue>>;
}

/** Registered source description shared by catalog and collector layers. */
export interface InsightProvider {
  readonly id: InsightSource;
  readonly displayName: string;
  readonly url: string;
  /** null when the publisher states no license; redistribution stays prohibited. */
  readonly license: string | null;
  /** false when terms forbid redistribution of derived records. */
  readonly redistributable: boolean;
}

/** Narrows untrusted JSON to a row object the parsers can inspect. */
export function isInsightRow(value: unknown): value is InsightRow {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Drops records that cannot carry a measurement: identity, unit, and a finite value. */
export function isNormalizedBenchmarkRecord(value: unknown): value is NormalizedBenchmarkRecord {
  if (!isInsightRow(value)) return false;
  const record = value as Partial<InsightRecord>;
  return typeof record.modelId === 'string' && !!record.modelId.trim() &&
    typeof record.metric === 'string' && !!record.metric.trim() &&
    typeof record.unit === 'string' && !!record.unit.trim() &&
    typeof record.value === 'number' && Number.isFinite(record.value) &&
    typeof record.observedAt === 'string' && !!record.observedAt &&
    typeof record.sourceAsOf === 'string' && !!record.sourceAsOf;
}

/** Every known source id; keeps providers closed without widening InsightSource. */
export function isInsightSource(value: unknown): value is InsightSource {
  return value === 'arena' || value === 'artificial-analysis' ||
    value === 'openrouter' || value === 'cognition' || value === 'opencode-data';
}