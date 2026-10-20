import type { Top10RecordInput } from './letter-top10-rank.js';
import {
  ARENA_CODING_SOURCE,
  type ParsedArenaCodingModel,
} from './arena-coding-types.js';

/** #190 단위A: 파싱 결과 → 저장소 행 계약. once·DB·가중치 연결은 후속 단위다. */
export const ARENA_CODING_SOURCE_ID: string = ARENA_CODING_SOURCE;

export interface ArenaCodingRecord extends Top10RecordInput {
  /** 날짜 한정자 등 병합 금지 근거. 동점이어도 이 값이 다르면 다른 행이다. */
  readonly effortQualifier?: string;
  readonly arenaSubset?: string;
  readonly arenaCategory?: string;
}

/** base-effort 접미어 형태로 매핑해 기존 `splitBaseAndEffort`과 호환된다. */
export function toArenaCodingRecord(parsed: ParsedArenaCodingModel): ArenaCodingRecord {
  return {
    modelId: parsed.effort === 'default' ? parsed.baseId : `${parsed.baseId}-${parsed.effort}`,
    metric: parsed.metric,
    value: parsed.value,
    ...(parsed.effortQualifier !== undefined && { effortQualifier: parsed.effortQualifier }),
    arenaSubset: parsed.subset,
    arenaCategory: parsed.category,
  };
}

/**
 * 후속 저장 통합 전 복합 식별키. 날짜 qualifier·subset·category가 다르면
 * 다른 행이다(병합 금지). 현재 단위는 실제 DB에 연결하지 않는다.
 */
export function arenaCodingIdentityKey(parsed: Pick<ParsedArenaCodingModel,
  'subset' | 'category' | 'baseId' | 'effort' | 'effortQualifier'>): string {
  return [ARENA_CODING_SOURCE_ID, parsed.subset, parsed.category,
    parsed.baseId, parsed.effort, parsed.effortQualifier ?? '-'].join('|');
}
