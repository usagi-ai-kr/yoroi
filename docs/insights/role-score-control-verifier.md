# 정규 보정 대조 검증기 (준비)

- runner: `/tmp/yoroi-calibrated-letter-verify.mjs` (55줄, dir 인자). 제품 수정 없음.
- 재사용: #160 exact-control 옵션(최신 filter·Free·previousRanks·cohort) + 고정 공개 스냅샷. mock 없이 정본 실제 생성.
- 대조 항목: raw 모델/effort/score/▽/rank == R 정본, `normalRankScores(population)` 기대 표시 == 제품 scoreText, 모집단 38/19·finite/미측정, 양 role 분포.

## 실행 결과
| dir | role | pop | raw==#160 | prodRawTop==popTop | cal 모듈 | 제품 표시==정규 |
| --- | --- | --- | --- | --- | --- | --- |
| repo(통합 working) | 오케/워커 | 38/19 | true | true | true | true |
| clean(/tmp/yoroi-r-clean) | 오케/워커 | 38/19 | true | true | false | false |

- repo working tree에 w1 통합(letter-top10-unified.ts가 normalRankScores import)이 있어 **검증기 전 항목 PASS**.
- clean은 통합 미반영이라 cal 모듈 부재 → clean 반영 후 재실행 대상.
- w1 통합 report 미도착 → 최종 판정 보류(대기 점유 없음).

## 남은 계약(clean 반영 후)
- raw·effort·▽·rank 완전 동일, 제품 표시 == 정규 기대치, 모집단 38/19·finite/미측정 처리 동일, 분포 센터/SD/중앙.
