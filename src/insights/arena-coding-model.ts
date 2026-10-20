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

/** 한정자 슬러그: 소문자·비알파벳은 '-'. 날짜·하네스 표기를 그대로 구분한다. */
const qualifierSlug = (qualifier: string): string =>
  qualifier.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** 저장소 model id 규칙: base + effort 접미사. 한정자가 있으면 base 뒤에 '--한정자' 를 넣는다.
 *  이래야 날짜형 변형이 기본 모델과 같은 series 키를 공유하지 않는다(자동 병합 금지, #168 결정).
 *  effort 접미사는 끝에 두어 splitBaseAndEffort 가 effort 를 그대로 읽는다. */
export function arenaCodingModelId(parsed: Pick<ParsedArenaCodingModel, 'baseId' | 'effort' | 'effortQualifier'>): string {
  const qualifier = parsed.effortQualifier === undefined ? '' : qualifierSlug(parsed.effortQualifier);
  const base = qualifier ? `${parsed.baseId}--${qualifier}` : parsed.baseId;
  return parsed.effort === 'default' ? base : `${base}-${parsed.effort}`;
}

/** base-effort 접미어 형태로 매핑해 기존 `splitBaseAndEffort`과 호환된다. */
export function toArenaCodingRecord(parsed: ParsedArenaCodingModel): ArenaCodingRecord {
  return {
    modelId: arenaCodingModelId(parsed),
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
