# 점수 보정 통합 (w1 → w4, 2026-10-16)

- 소유: `letter-top10-unified.ts`·`letter-top10-legend.ts`·`letter-markdown-format.ts`·새 테스트·본 문서·계약 2종.
- w2 순수 helper `letter-score-normal.ts` `normalRankScores`는 **수정 없이 import**만. source core·git·원격·레터발행 없음.

## 1. 통합 위치·동작

- **위치**: `unified.ts` `pick()`에서 `scoreRoleCandidatesFromSources()`가 대표 effort·eligible·filter까지 마친 **반환 직후**(Top10 컷 전)에 `normalRankScores(scored.map(s=>s.score))` 호출 → `cal` Map으로 `buildList` 전달.
- **계산**: 실제 역할 대표 모집단(선택자격 후·Top10 컷 전) raw 점수 배열을 **한 번** 정규순위 보정 `p=midrank→Φ⁻¹→50+10z`(권장 B, clamp 0..100).
- **필드 구분**: `scoreText = 보정값`(표시 numeric과 일치), `rawScore = 원점수`(추적). `scoreComponents`·`rank`·`representative`·`belowZone`은 **raw 그대로 파괴 안 함**.
- **미측정 50 포장 없음**(helper가 NaN 유지), 비유한 보정 표시값은 기존 미측정 표기 -로 렌더.

## 2. zone▽·선발·순위는 raw 유지 (보정 무관)

- `belowZone = raw < max(raw)×0.85(오케)/0.60(워커)` — `score.ts:91` **원정책 유지**.
- 보정은 **표시 scoreText만** 바꾼다 → 자격·Top10 선발·보충·순위가 바뀌지 않는다. 정규순위는 단사(raw 순서)라 표시 순서도 raw 순서와 일치(순위 무변경 증명).
- legend(▽ 줄에 병합): `표시 점수=역할별 정규순위 50중심(근사), 임계·차원·순위=원점수` — `LEGEND_LINES.length===9`·예산 3800 유지(신규 줄 대신 기존 ▽ 줄 병합, verbose 2곳 트림으로 예산 offset).

## 3. 밴 경계 (미구현, 문서화만)

- 밴 기능은 **현재 구현 아님**. 향후 ban은 **이후 선발 관문**에 적용 → **밴 모델도 보정 모집단엔 포함**(점수·분포에서 제외하지 않음). 모집단 계약과 동일.

## 4. n=0/1/상수·근사 (계약 교정)

- n=0 → `[]`, n=1·상수 → `50`(상수 분산 10 불가), 미측정 NaN → 원값 유지(50 아님).
- **rank-normal은 finite·동점에서 정규 정확이 아니라 근사** (작은 n·동점 편향).

## 5. 검증·비소유 실패

- 새 테스트 `tests/insights-role-score-calibration.test.ts` **w1 4/4, w4 5/5 통과**(scoreText 보정·rawScore 보존·순위 단조·역할 독립·n=0/1/상수·NaN/±Inf·비유한 표시 -).
- 예산 `render-top10`·`top10-render` 통과, legend guide(개수 9)·w4 validate 통과. w1 보고는 typecheck·validate PASS; w4 typecheck는 pnpm 서명 확인 registry fetch 실패로 미확인.
- **비소유 실패 26건**: 전부 `scoreText`가 raw→보정으로 바뀌어 기존 raw 기대값(`80.5/70.0/15.0` 등)을 단정하는 테스트. 실제는 보정값(`59.7/50.0/40.3`, 중앙 50·순위 유지). **원인 동일 — scoreText 보정 전환(의도된 기능)**, 테스트 소유주가 기대값을 보정값으로 갱신해야 함. 목록은 JSON 보고에 정확히 기재.


## 6. 비유한 raw 점수와 표시 계약

- 합성 priceInput=priceOutput=1e308은 유한 입력이지만 혼합 단가 (3*input+output)/4가 Infinity로 넘친다. 기존 R 점수 경로가 I/(P+.01)=0, log10(0)=-Infinity를 만들고 min-max 연산에서 NaN raw score로 전파한다.
- 이는 보정 통합이 아닌 source-core raw 계산 문제다. 원점수·raw rank·▽·components는 바꾸지 않는다. 보정 분포는 finite raw만 집계하고 비유한 scoreText는 -로 표시한다. 가격 공식 수정은 별도 범위다.
