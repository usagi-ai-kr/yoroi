/** #190 단위A: Arena 코딩 서브셋 HF 행 타입. 신규 source 계통 전용이다. */

/** 기존 overall(`arena`)과 분리된 신규 source id 계약. */
export const ARENA_CODING_SOURCE = 'arena-coding' as const;
/**
 * 직접 확인된 코딩 서브셋만 허용. 일반 agent aggregate와 reliability 계열은
 * 원문 미확인이라 거부한다. tool_hallucination 등 일반 agent 신호도 제외.
 */
export const ARENA_CODING_SUBSETS = [
  'webdev',
  'agent_bash_recovery_steps',
] as const;
export type ArenaCodingSubset = (typeof ARENA_CODING_SUBSETS)[number];
/** 코딩 점수 지표 계약(서브셋 스키마별 대표값). */
export const ARENA_CODING_RATING_METRIC = 'arena_coding_rating' as const;
export const ARENA_CODING_SCORE_METRIC = 'arena_coding_score' as const;

/** HF parquet→JSON 행(webdev 등 텍스트형). 필드 미존재·형식 오류는 파서가 버린다. */
export interface ArenaCodingTextRow {
  readonly model_name?: unknown;
  readonly organization?: unknown;
  readonly license?: unknown;
  readonly rating?: unknown;
  readonly rating_lower?: unknown;
  readonly rating_upper?: unknown;
  readonly variance?: unknown;
  readonly vote_count?: unknown;
  readonly rank?: unknown;
  readonly category?: unknown;
  readonly leaderboard_publish_date?: unknown;
}
/** HF parquet→JSON 행(agent형: IPS score 체계). */
export interface ArenaCodingAgentRow {
  readonly model_name?: unknown;
  readonly organization?: unknown;
  readonly license?: unknown;
  readonly score?: unknown;
  readonly score_ci_lower?: unknown;
  readonly score_ci_upper?: unknown;
  readonly observation_count?: unknown;
  readonly session_count?: unknown;
  readonly rank?: unknown;
  readonly category?: unknown;
  readonly leaderboard_publish_date?: unknown;
}
export interface ParsedArenaCodingModel {
  readonly subset: ArenaCodingSubset;
  readonly category: string;
  readonly displayName: string;
  readonly baseId: string;
  readonly effort: string;
  /** `(High, 20260813)` 같은 날짜 한정자. 원문 보존, 자동 병합 금지. */
  readonly effortQualifier?: string;
  readonly metric: typeof ARENA_CODING_RATING_METRIC | typeof ARENA_CODING_SCORE_METRIC;
  readonly value: number;
  readonly ciLower?: number;
  readonly ciUpper?: number;
  readonly observations?: number;
  readonly rank?: number;
  readonly publishDate?: string;
}
