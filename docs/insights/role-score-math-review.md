# 정규순위 점수 수학 독립리뷰 (w3)

- 대상: `src/insights/letter-score-normal.ts`(리뷰 당시 43줄), `tests/insights-score-normal.test.ts`. 구현 w2, 통합 w1.
- 방식: 읽기 전용. 소스·설정·테스트·원격·git 변경 없음. 현재 세션·모델(Haiku 5.5) 그대로 수행.
- 사용자 결정 대조(`docs/insights/orchestrator-r-release-task.md`): `[]`, 단일·전부 동점 50, 미측정 NaN 불변, 동점·finite 모집단의 정규형태는 근사 → 전부 일치.

## 판정
- blocking 결함 없음. 순위 보존, 동점 midrank, invalid 원값 유지, n=0/1/전부 동점, 순열 불변은 독립 오라클과 일치.
- 비차단 발견 3건(F1–F3). 단위테스트 8/8, 소비 테스트 `insights-role-score-calibration` 4/4 통과(리뷰 당시).
- 후속(w3, `role-score-math-followup.md`): F2·F3 해결, F1 비차단 근거 기록(코드 미변경).

## 검증 방법
- 오라클: Python `statistics.NormalDist().inv_cdf` + 사양(midrank → p=(mid0+0.5)/N → 50+10z → clamp). 모듈의 erf·bisection을 미러링하지 않음.
- 모듈 호출: `node --import tsx -e` 인라인(파일 미생성), 고정 시드 합성 입력.
- 입력: distinct N=2…1e6, 동점 세트, 역할 후보 크기 19·38, ±MAX·subnormal·-0/0, Inf/NaN 혼합.

## 실측
| 항목 | 결과 |
|---|---|
| 순위·동점·순열 | 전 세트 단조 True, 동점 동일점수 True, 순열 불변 True |
| invalid | NaN/±Inf 원값 유지 전 세트 True |
| 표시 오차(오라클 대비) | N≤1e3 최대 3.3e-4; N=1e5 최대 1.8e-3(1자리 반올림 flip 6건); N=1e6 최대 2.8e-3(flip 36건) |
| inverseNormal 중심 p∈[0.01,0.99] | 최대 1.4e-5점 |
| inverseNormal 꼬리 | p∈[1e-9,1e-6) 5.8e-3점, [1e-6,1e-4) 2.5e-3, [1e-4,1e-2) 7.4e-4 |
| 단조성(dense 8002점) | 역전 0, 평탄 0 |
| clamp 발동 임계 | N*=0.5/Φ(-5)≈1,744,278 (미만에서 미발동) |

## 평균·SD (목표 중심50/SD≈10 대조)
| 입력 | n | 평균 | 모집단 SD |
|---|---|---|---|
| 동점 없음 | 2·3·5·10 | 50.00 | 6.75·7.90·8.76·9.38 |
| 동점 없음 | 19·38·100 | 50.00 | 9.67·9.83·9.94 |
| 0..5 무작위 동점 | 19 | 49.81 | 8.59 |
| 하단 6동점+13 | 19 | 50.33 | 8.93 |
| 하단 19동점+19 | 38 | 50.59 | 8.41 |
| [0,0,0,0,100] | 5 | 50.54 | 6.14 |

## 발견
- F1 (비차단, 수치 아티팩트) `src/insights/letter-score-normal.ts:8,10,12`: A&S 계수합 0.999999999 → erf(0)=+1e-9. 부호 분기 `x<0?-1:1`(10행)과 맞물려 0에서 약 2e-9 불연속.
  재현: `inverseNormal(0.5+4e-10)`=-2.5e-59 (기대 +1.003e-9), `inverseNormal(0.5+6e-10)`=+2.51e-10 (기대 +1.504e-9). 영향: |Δz|≤1.3e-9, 점수 ≤1.3e-8, 1자리 출력 영향 없음. → 후속: 코드 미변경, 비차단 근거는 role-score-math-followup.md.
- F2 (비차단, 문서) `letter-score-normal.ts:15`: "bisection(|오차|<=1e-12)"는 근사 CDF 대비 잔차다. 실제 Φ⁻¹ 대비 오차는 중심 ~1e-6(p=0.025: 1.2e-6), p=1e-7에서 3.5e-4, p<1e-6에서 최대 5.8e-4(z 단위). 정정 필요. → 해결(w3): 주석을 구간 분해능과 CDF 근사오차로 분리 정정.
- F3 (비차단, 테스트) `tests/insights-score-normal.test.ts:46-47`: 기대값을 모듈 자신의 `inverseNormal`로 계산 → 분위수 정확도는 검증되지 않음. NormalDist 기준 고정값 1–2개 추가 권장. → 해결(w3): 자기참조 기대값을 고정 상수로 대체, 동점 분위 단언 추가.
- 근사 한계(결함 아님, 파일 주석 "근사" 명시 범위): 동점 세트 평균 편향 최대 +0.59(하단 동점 50%, n=38). 하단 동점은 평균↑, 상단은 ↓. 동점이 많으면 SD 8.4–8.9로 낮아진다. n≤10에서 SD<9.4.
- 범위 밖(미검증): 모집단 계약(역할 적격 1모델 1대표)은 호출부 `src/insights/letter-top10-unified.ts:86`(`scoreRoleCandidatesFromSources`) 소관 → w1/w4 확인 필요.

## 제안 상태 (w3 후속)
- F1: 코드 변경 없음(비차단, 1자리 표시 기준 근거는 followup 참조). 연속화는 필요 시 후속 과제.
- F2: 완료. 주석을 구간 분해능과 CDF 근사오차로 구분해 정정.
- F3: 완료. 자기참조 기대값 제거, 고정 상수 단언 추가. 풀의 동점 비율 확인은 w1/w4 소관.

## 재현
- `node --import tsx --test tests/insights-score-normal.test.ts` → 8/8
- `node --import tsx --test tests/insights-role-score-calibration.test.ts` → 4/4 (리뷰 당시). 후속 실행 5/5(외부 변경, 소유 밖).
