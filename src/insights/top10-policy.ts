/** 단일 출처 제외 문구: 압축 렌더(letter-top10-render)와 마크다운(letter-markdown)이 같은 문구를 쓴다.
 *  근거: docs/insights/top10-scoring.md (Fable·Astra는 고비용). */
export const EXCLUSION_NOTE = '제외: Fable·Astra, 혼합 단가 $3/1M 이상, 동일 계열은 최신 변형만, off-peak는 확인분만 적용';

/** 지수 외 후보 근거 지표(unmeasured-evidence): 이 지표가 있으면 AA 미측정 모델도 후보 풀에 유지한다(2026-10-13 사용자 지시).
 *  OpenRouter total_tokens가 기준 usage, OpenCode Data 토큰은 OpenRouter 결측 시의 보조 usage다. */
export const EVIDENCE_METRICS = ['total_tokens', 'opencode_data_tokens'] as const;
