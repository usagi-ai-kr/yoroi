# 역할별 점수 분포·보정 조사 (1.0.2, 정정판)

## 모집단 (final R exact control과 동일 파이프라인)
- computeRoleTop10과 동일 풀(PLAN_CATALOG+Free, freeRows 증거 포함) + 동일 옵션. 자격 후 1모델 1대표.
- 검증: 모집단 상위10이 final comparison JSON 20행과 **완전 일치**(오케·워커). n: 오케 38, 워커 19.

| 역할 | mean | sd | min | max | p10 | p25 | p50 | p75 | p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 오케 | 44.4 | 25.7 | 0.0 | 89.4 | 3.1 | 28.6 | 44.3 | 65.7 | 74.4 |
| 워커 | 55.6 | 10.9 | 36.3 | 77.0 | 43.6 | 47.6 | 55.1 | 63.8 | 69.8 |

- 워커 sd가 작은 건 낮아서가 아니라 **분포가 좁다**: AA intel 하한 33이 저단을 자름. 오케는 Cog·AA max로 넓다.

## 보정 3안 (순위 보존, ▽는 상대 cutoff라 변동)
| 안 | 오케 top3 | 오케 dist | 오케 ▽ | 워커 top3 | 워커 dist | 워커 ▽ |
| --- | --- | --- | --- | --- | --- | --- |
| raw | opus 89.4·sol 82.7·sonnet 82.0 | 44.4/25.7 | 34 | luna 77.0·haiku 71.5·muse 69.3 | 55.6/10.9 | 4 |
| T 50+10z | opus 67.5·sol 64.9·sonnet 64.6 | 50.0/10.0 | 25 | luna 69.7·haiku 64.7·muse 62.7 | 50.0/10.0 | 5 |
| C CDF×100 | opus 96.0·sol 93.2·sonnet 92.8 | 50.6/30.9 | 30 | luna 97.6·haiku 92.9·muse 89.7 | 49.3/30.2 | 12 |
| R rank정규 | opus 72.2·sol 67.6·sonnet 65.1 | 50.0/9.8 | 33 | luna 69.4·haiku 64.1·muse 61.2 | 50.0/9.7 | 4 |

## 정정 (이전 조사 오류)
- **CDF 설명 정정**: 정규 raw에 CDF를 적용하면 **균등분포**가 된다(수학적 사실). 실측 sd 30.9는 raw가 정규가 아님을 뜻할 뿐, '양극단 몰림'으로 단정할 수 없다. 히스토그램 미측정 → 그 주장 삭제.
- **R 한계**: 50+10·Φ⁻¹(midrank)는 소표본·동점에서 mean/sd가 정확히 50/10으로 **강제되지 않는다**(근사). 상수(raw sd=0) 단일값이면 Φ⁻¹ 정의 불가.
- **T**: mean 50·sd 10 정확(상수 제외). raw가 비정규면 형태는 그대로 남는다.

## 권장 (확정)
- 사용자가 정규 순위 변환(50중심·SD 약10)을 확정 선택했다. 구현은 [role-score-normal-math.md](role-score-normal-math.md), preview는 [role-score-calibration-preview.md](role-score-calibration-preview.md).
- raw 가중·bonus 불변. 보정은 display 계약만 바꾸며 순위 불변·▽·기여표/scoreText 영향 → 확정 반영은 통합 단계.
