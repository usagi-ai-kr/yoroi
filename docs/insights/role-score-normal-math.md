# 정규 순위 점수 수학 모듈 (1.0.2)

## 인터페이스
- `normalRankScores(values: readonly number[]): number[]` — 입력 순서 유지.
- `inverseNormal(p)`·`NORMAL_SCORE_MEAN=50`·`NORMAL_SCORE_SD=10` export.

## 규칙
- finite만 모집단. invalid(NaN/±Inf)는 원값 유지(렌더에 쓰지 않음).
- ascending → exact-score 동점 midrank → p=(midrank0based+0.5)/N → 50+10·Φ⁻¹(p) → 0..100 clamp.
- finite 0개 → 입력 그대로. 1개 또는 전부 동점 → finite 전부 50.

## 수치·한계
- Φ는 A&S erf 근사(|오차|<1.5e-7), Φ⁻¹는 bisection(|z 오차|~1e-6). 의존성 없음.
- 평균/SD는 유한 n·동점에서 정확히 50/10이 아니라 **근사**다(작은 n·동점 편향). 상수 단일값은 50.
- 모델 하드코딩·새 옵션 없음. w1 통합에서 import할 signature 고정.
