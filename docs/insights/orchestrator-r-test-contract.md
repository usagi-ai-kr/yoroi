# R 복구 독립 검증 계약 (w1 조사, 2026-10-16)

- 지시: `orchestrator-r-release-task.md` 부재 → 패킷 `yoroi-r-contract-w1` + preflight/study 문서로 조사.
- 범위: 계약 조사만. 제품·config·버전·git·원격 변경 없음. 구현은 w2, 실제 diff 독립 리뷰는 후속.

## 요구 계약 (5가지)

| # | 계약 | 정의 |
| - | - | - |
| R1 | R70/5/10/15 | 오케 성능/사용량/속도/가성비 = 0.7/0.05/0.1/0.15, 합 1(오차 1e-9) |
| R2 | I/(P+.01) log10 | `valueForMoney = I/(P+0.01)` (제곱 제거, 1.0.2 확정), `Math.log10` 후 소스별 min-max |
| R3 | Cog 그대로 | 오케 price 2leg: AA(I/(P+.01), 높을수록) + Cog USD/task(낮을수록) 소스 표준화 |
| R4 | source max | 차원값 = 소스마다 min-max 후 같은 차원 안 최댓값 |
| R5 | worker·Grok 불변 | 워커 30/20/10/40 + cap 5. Grok 4.6/4.7 세대 독립 예외 유지, 점수상 4.6 이탈 허용(고정 순위 없음, 순위 재계산) |

## b408803 제거 → 복구 지점 (defaults/raw/render)

- `config/score-weights.json`: orchestrator price 키 0.15 복구(합 1).
- `letter-top10-score-weights.ts`: `SCORE_WEIGHTS_DEFAULTS.orchestrator` 0.7/0.05/0.1/0.15,
  `ROLE_WEIGHT_DIMENSIONS.orchestrator` → 네 칸, `ScoreWeights` Partial→Record,
  `validateScoreWeights` 검증 차원 ROLE_WEIGHT_DIMENSIONS→SCORE_WEIGHT_DIMENSIONS.
- `letter-top10-score-policy.ts`: `ROLE_DIMENSIONS` 고유 맵, `ROLE_DIMENSION_LABELS.price='가성비'`,
  `ROLE_SOURCES.orchestrator.price` []→['aa','cognition'], `valueForMoney` 복구(I·P 결측·I≤0→undefined).
- `letter-top10-score-raw.ts`: `Raw.orchValue` 필드 + `pickEffortValues` 오케 분기
  `r.orchValue = valueForMoney(r.aaPerf, r.aaPrice)`.
- `letter-top10-score.ts`: PARTS 오케 2leg 복구(`orchValue` log10 높을수록 + `cogCost` low+safeLog),
  가중 합산 `w[d]` 복구(전 칸 필수), PRICE_MISSING orchestrator undefined 유지(.99 미적용, 결측 0).

## 최소 회귀 케이스 (w2가 복구 후 실행)

1. R1: `insights-c-policy.test.ts:18` ROLE_DIMENSION_WEIGHTS deepEqual을 0.7/0.05/0.1/0.15로 수정,
   `insights-dimension-contract.test.ts:14` ROLE_W price 0→0.15.
   `validateScoreWeights` 합≠1 예외, `insights-top10-source-policy.test.ts:18` 합 1 유지.
2. R2: 제거된 `insights-c-policy.test.ts` 2건 복원 —
   ① `valueForMoney(90,2)=90/2.01`, `(50,0)=50/0.01`, 결측·I=0→undefined, log10 min-max scoreText 검증.
   ② I=0 항목은 min-max 스케일에서 제외(0), 기존 3항목 스케일 불변.
3. R3: `insights-dimension-contract.test.ts:54` "Cog USD/task도 오케 가격 근거가 아니다"를
   반전 — Cog USD/task가 2leg 중 하나로 반영되며 AA와 원값 혼합 없음.
4. R4: `insights-top10-source-policy.test.ts:46` 'each dimension takes the higher source value' 유지,
   오케 price는 AA·Cog 표준화 후 max.
5. R5: `insights-dimension-contract.test.ts:58` 워커 30/20/10/40, `WORKER_BONUS_CAP_DEFAULT=5`,
   `insights-top10-filter.test.ts:17-21`·`insights-top10-price-policy.test.ts:42` grok-4-6 후보 유지.
   Grok 4.6/4.7 세대 독립 예외만 검사 — 점수상 4.6 이탈 허용, 고정 순위 단정 금지(순위 재계산).

## 소유권 아닌 파일 의존성 (핵심)

- `tests/helpers/dimension-reference.ts`(비소유) 참조 구현이 오케 가성비를 `log10(I²/(P+.01))`(line 64)로 계산 —
  정정 계약 `I/(P+.01)`과 불일치. core(w2)·참조 헬퍼 모두 선형으로 맞춰야 dimension-contract 대조가 통과.
  헬퍼를 고치지 못하므로 해당 대조(`near(score, ref)`)는 의존성 FAIL로 명시.
- `letter-top10-score-policy.ts`(비소유)에서 `ROLE_DIMENSION_LABELS`(price→'가성비') 미export —
  렌더 복구는 이 심볼이 core에서 재export되어야 컴파일. w2 몫, 의존성 명시.

## 검증 결과 (읽기 전용, 제품 변경 없음)

- b408803 소스 diff·현재 config·weights/policy/raw/score 원문 대조 완료.
- w2 core 복구 진행 확인: `config` orchestrator price 0.15, `valueForMoney=I/(P+.01)`,
  `ROLE_WEIGHT_DIMENSIONS.orchestrator` 4차원, `ROLE_SOURCES.orchestrator.price=['aa','cognition']`,
  PARTS 오케 2leg(orchValue 정방향·cogCost 역방향) — 계약과 일치. 단 `ROLE_DIMENSION_LABELS` 미export.
- 위 의존성 2건(참조헬퍼 I²·policy LABELS)을 제외하면 렌더·계약 테스트는 복구 가능.
- 새 테스트 실행 없음(core 미완). 렌더·계약 테스트는 w2 core 완료 후 실행, 실패분은 의존성 표기.
