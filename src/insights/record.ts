export type InsightSource = 'arena' | 'artificial-analysis' | 'openrouter';

export type InsightMetadataValue = string | number | boolean | null |
  readonly InsightMetadataValue[] | { readonly [key: string]: InsightMetadataValue };

export interface InsightRecord {
  readonly source: InsightSource;
  readonly modelId: string;
  readonly modelAlias?: string;
  readonly metric: string;
  readonly value: number;
  readonly unit: string;
  readonly metadata?: Readonly<Record<string, InsightMetadataValue>>;
  readonly category: string;
  readonly observedAt: string;
  readonly sourceAsOf: string;
  readonly sourceUrl: string;
  readonly sourceName: string;
  readonly license: string | null;
  readonly attributionText: string;
  readonly method: string;
  readonly schemaVersion: string;
}
