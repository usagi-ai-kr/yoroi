import { ARENA_CODING_RATING_METRIC, type ArenaCodingSubset, type ParsedArenaCodingModel } from './arena-coding-types.js';
import { SourceError } from '../app/usage-source.js';
import { isIsoTimestamp, type ParseRowResult } from './parse-utils.js';
import type { InsightRecord } from './record.js';
import { fetchArenaCodingSubset, type ArenaFetchOptions } from './sources-arena-coding.js';

/** #190 단위C: Arena 코딩 소스(HF rows). 기존 overall arena 계통과 분리된 신규 source id다. */
export const ARENA_CODING_SOURCE_ID = 'arena-coding';
export const ARENA_CODING_SCHEMA_VERSION = 'arena-coding-v1';
/** 요청 범위(비밀 없음). subset·split 고정 — 다른 범위와 캐시를 섞지 않는다. */
export const ARENA_CODING_REQUEST_SCOPE = 'arena-coding:hf-rows:webdev.agent_bash_recovery_steps:latest';
export const ARENA_CODING_URL = 'https://datasets-server.huggingface.co/rows';
export const ARENA_CODING_DATASET_URL = 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset';
export const ARENA_CODING_ATTRIBUTION = `Source: Arena Leaderboard Dataset (${ARENA_CODING_DATASET_URL}). CC BY 4.0.`;
export const ARENA_CODING_SUBSETS: readonly ArenaCodingSubset[] = ['webdev', 'agent_bash_recovery_steps'];

/** 부분 수집(서브셋 단위) 결과. 한 서브셋 실패가 다른 서브셋을 중단시키지 않는다. */
export interface ArenaSubsetOutcome {
  readonly subset: ArenaCodingSubset;
  readonly rows: readonly ParsedArenaCodingModel[];
  readonly status: 'ok' | 'partial' | 'error';
  readonly error?: string;
}
export interface ArenaCodingPayload { readonly outcomes: readonly ArenaSubsetOutcome[]; }

/** 두 서브셋을 순차 수집한다. 실패한 서브셋만 error로 남고 나머지 행은 보존된다. */
export async function fetchArenaCodingPayload(options: ArenaFetchOptions = {}): Promise<ArenaCodingPayload> {
  const outcomes: ArenaSubsetOutcome[] = [];
  for (const subset of ARENA_CODING_SUBSETS) {
    const result = await fetchArenaCodingSubset(subset, options);
    outcomes.push({ subset, rows: result.rows, status: result.status, ...(result.error !== undefined && { error: result.error }) });
  }
  if (outcomes.length > 0 && outcomes.every(outcome => outcome.status === 'error')) throw new SourceError('unavailable');
  return { outcomes };
}

/** 게시일이 없는 행은 기준일(비교선)을 세울 수 없어 버린다(관측시각 fallback은 검증에서 거부된다). */
function toRecord(parsed: ParsedArenaCodingModel, observedAt: string): InsightRecord | undefined {
  const publishDate = parsed.publishDate;
  if (publishDate === undefined) return undefined;
  const modelId = parsed.effort === 'default' ? parsed.baseId : `${parsed.baseId}-${parsed.effort}`;
  return { source: ARENA_CODING_SOURCE_ID, modelId, modelAlias: parsed.displayName, metric: parsed.metric,
    value: parsed.value, unit: 'score', category: parsed.category, observedAt, sourceAsOf: publishDate,
    sourceUrl: ARENA_CODING_URL, sourceName: 'Arena Coding (HF Leaderboard)', license: 'CC-BY-4.0',
    method: 'official-dataset', schemaVersion: ARENA_CODING_SCHEMA_VERSION, attributionText: ARENA_CODING_ATTRIBUTION,
    metadata: { date: publishDate, subset: parsed.subset, effort: parsed.effort,
      ...(parsed.effortQualifier !== undefined && { effortQualifier: parsed.effortQualifier }),
      ...(parsed.rank !== undefined && { rank: parsed.rank }) } };
}

/** 페이로드를 레코드로 바꾼다. 실패·부분 서브셋과 발행일 없는 행은 진단 행으로 남고 다른 행은 살아 있다. */
export function parseArenaCodingPayload(payload: unknown, observedAt: string): readonly ParseRowResult[] {
  if (typeof payload !== 'object' || payload === null || !Array.isArray((payload as ArenaCodingPayload).outcomes)) {
    throw new Error('arena-coding invalid-response');
  }
  if (!isIsoTimestamp(observedAt)) throw new Error('arena-coding invalid-response');
  const results: ParseRowResult[] = [];
  for (const outcome of (payload as ArenaCodingPayload).outcomes) {
    for (const parsed of outcome.rows) {
      const record = toRecord(parsed, observedAt);
      if (record === undefined) {
        results.push({ ok: false, index: results.length, reason: `arena-coding ${outcome.subset}: missing leaderboard_publish_date`, warnings: [] });
        continue;
      }
      results.push({ ok: true, index: results.length, records: [record], warnings: [] });
    }
    if (outcome.status !== 'ok') {
      results.push({ ok: false, index: results.length,
        reason: outcome.error !== undefined ? `arena-coding ${outcome.subset}: ${outcome.error}` : `arena-coding ${outcome.subset}: partial subset`,
        warnings: [] });
    }
  }
  return results;
}

/** 순위 코호트 지표: webdev Code Arena 레이팅(높을수록 좋음). agent IPS는 다른 리딩보드라 섞지 않는다. */
export const ARENA_CODING_RANK_METRIC = ARENA_CODING_RATING_METRIC;
