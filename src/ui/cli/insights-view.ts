/** UI-owned structural contract; the composition layer supplies compatible results. */
type ComparisonView = { readonly comparable: false; readonly reason: string } | {
  readonly comparable: true;
  readonly absoluteChange: number;
  readonly percentChange: number | null;
  readonly percentUnavailable?: string;
  readonly previousDate: string;
  readonly currentDate: string;
};
type TrendView = { readonly status: 'unavailable'; readonly reason: string } | {
  readonly status: 'complete' | 'partial' | 'insufficient-history';
  readonly direction: 'increasing' | 'decreasing' | 'unchanged' | 'mixed' | null;
  readonly startDate: string;
  readonly endDate: string;
  readonly missingDays: number;
  readonly initialLoad: boolean;
  readonly points: readonly { readonly date: string; readonly value: number | null }[];
};
interface ReferenceView {
  readonly id: string;
  readonly sourceName: string;
  readonly metric: string;
  readonly category: string;
  readonly schemaVersion: string;
  readonly unit: string;
  readonly sourceUrl: string;
  readonly comparisonDate: string | null;
  readonly observedAt: string;
}
interface EvidenceView extends ReferenceView {
  readonly modelId: string;
  readonly value: number;
  readonly sourceAsOf: string;
  readonly comparison: ComparisonView;
  readonly trend: TrendView;
}
type RankResultView = { readonly comparable: false; readonly reason: string } | {
  readonly comparable: true;
  readonly changes: readonly {
    readonly modelId: string;
    readonly currentRank: number | null;
    readonly previousRank: number | null;
    readonly rankChange: number | null;
    readonly status: 'ranked' | 'entered' | 'exited' | 'missing';
  }[];
};
interface RankView extends ReferenceView {
  readonly previousDate: string | null;
  readonly result: RankResultView;
}
type SectionView = { readonly title: string } & (
  { readonly kind: 'metadata'; readonly publicationDate: string; readonly issuedAt: string } |
  { readonly kind: 'summary'; readonly items: readonly {
    readonly text: string; readonly evidenceIds: readonly string[];
  }[] } |
  { readonly kind: 'evidence'; readonly rows: readonly EvidenceView[] } |
  { readonly kind: 'ranks'; readonly groups: readonly RankView[] } |
  { readonly kind: 'sources'; readonly entries: readonly {
    readonly name: string; readonly url: string; readonly observedAt: string;
    readonly attribution: string; readonly license: string | null;
  }[] } |
  { readonly kind: 'failures'; readonly entries: readonly { readonly source: string; readonly reason: string }[] } |
  { readonly kind: 'limitations'; readonly items: readonly string[] }
);
export type InsightLetterView =
  { readonly ok: true; readonly sections: readonly SectionView[] } |
  { readonly ok: false; readonly reason?: string; readonly failedSources: readonly string[] };
