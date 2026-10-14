# p81 분배: AA 작업당 비용·총비용을 워커 가격 근거로 (2026-10-14 사용자 요청)

사용자 원문: "나는 이 것들을 많이 참고하고 싶은데"(AA intelligence-vs-cost-per-task / total-cost)
o는 분배만 맡는다. 결과: `scratch/reports/yoroi-p81-aa-cost-inputs.md`(o). config·src 변경은 사용자 결정 전까지 금지.
오케(82/6/12, 가성비 없음)는 건드리지 않는다. 오케 적용 여부는 별도 사용자 결정 항목이다.

## 사실 (메신저)

- 오늘 DB `aa-v2:free:language-models:all` 5,439행에 `intelligence_index_cost_per_task` 186행, `intelligence_index_total_cost` 186행이 있다.
- 메신저는 워커 가격 현행 근거를 "AA I²/혼합단가 + Cog USD/task"로 적었다. o 메모: 이는 옛 오케 가성비 정의일 수 있다.
  docs상 워커 가격은 AA 혼합 단가 base 최소다. K1에서 실제 근거를 확정한다.

## 단계

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| K1 | w1 | 워커 가격 차원의 현행 소스를 파일:줄로 확정한 뒤 후보 ①~⑤ 계산(읽기 전용) | yoroi-p81-w1k-report.json + yoroi-p81-w1k-table.md |
| K2 | K1 뒤 w2 | K1 독립 검증(①·④·추천 행 재계산) | yoroi-p81-w2k-report.json |
| K3 | w3→w2 재배정(w3 16:23 전송 후 산출물 없이 정지) | 차원별 소스 조합 후보(아래) 워커·오케 Top10 계산·소스 기여도(읽기 전용) | yoroi-p81-w3k-report.json + yoroi-p81-w3k-table.md |
| M | V3·K2·K3 뒤, 계산하지 않은 워커 | p79·p80·p81 통합 비교표·추천 조합 정리 | 배정 시 |
| U | o→사용자 | 가중·규칙·가격 근거 결정 | — |

## K1 결과 (w1, o 확인)

- 현행 워커 가격은 AA 혼합 단가 base 최소 하나뿐이다(`score-policy.ts:18`, `score-raw.ts:24-25,53`). Cog 가격은 워커에 없고, I²/P는 p75에서 삭제된 옛 오케 정의다.
- 추천은 ④ 현행 + AA cost_per_task 결합(max)이다. 존 통과 6개는 동일하고, 이웃(max↔평균, log↔선형)에서 Top10 겹침은 8~9/10이다.
  전제: cost_per_task는 effort 편차가 커서 effort 정합(성능 최선 effort의 값)을 구현 단계에서 정해야 한다.

## K1 요구 (w1)

- 입력·경로는 p79 S1과 같다(오늘 DB /tmp 사본, 레터 렌더 경로, 메모리 오버라이드). 현재값이 #138 워커 Top10과 일치하는지 먼저 확인한다.
- 후보:
  - ① 현행 유지
  - ② AA `intelligence_index_cost_per_task` 단독
  - ③ AA `intelligence_index_total_cost` 단독
  - ④ 현행 + AA 결합(소스별 log min-max 후 차원 max)
  - ⑤ Cog USD/task를 AA cost_per_task로 대체(현행에 Cog 가격이 없으면 "해당 없음"으로 적는다)
- 각 후보를 가중 현재 30/20/10/40과 p79 A 25/15/10/50으로 계산한다.
  - 결과: Top10 멤버십·순위·🆕/🚪·파레토·결측 처리
  - 결측 처리: 186행 밖 모델은 .99 또는 다른 소스로 대체되는지, 그 수와 위치
- 과적합:
  - 이웃(결합 방식 max↔평균, log 유무)에서 멤버십이 유지되는지
  - 특정 모델을 노린 조정인지 데이터 요건에서 나온 조정인지
- 표는 100줄 이하로 쓴다. 추천 1개와 근거 3줄을 붙인다.

## K3 요구 (w3, 사용자 취지: "2지표·frontier code·router/opencode 사용량, 속도도 포함")

- 입력·경로·현재값 일치 확인은 K1과 같다. 오케 가중 82/6/12는 고정하고 소스만 바꾼다.
- 후보:
  - A: 성능 = AA index(워커 coding·오케 intelligence) + Cog correct/new_score, 사용량 = OR+OCD,
    가격 = AA cost_per_task + total_cost(워커만), 속도 = AA tok/s + TTFT 또는 end-to-end
  - B: A + Cog `cost` 가격 포함/제외
  - C: A + 속도에 Cog `duration_min`(46행, 표본 적음 명시)
  - 더 나은 조합이 있으면 1개까지 제안한다.
- 속도 지표·집계 비교:
  - 지표: tok/s vs TTFT vs end-to-end
  - 집계: 소스별 min-max 후 평균 vs max
  - 응답 시간 계열은 낮을수록 좋으므로 역방향으로 계산한다.
- 기여도: 소스를 하나씩 끈 결과(leave-one-out)로 어느 소스가 순위를 움직였는지 표로 남긴다.
- 커버리지: 후보별 근거 결측 모델 수와 처리(0·.99·대체)를 적는다.
- 과적합: 이웃 조합 안정성, 모델 표적 여부를 본다.
- 표는 100줄 이하로 쓴다. 추천 1개와 근거 3줄을 붙이고, 오케 적용 여부는 별도 항목으로 적는다.

## 공통 금지

config·src 수정, 커밋·push, 실제 API·네트워크 호출, `--refresh`, 모델명 조건, 모델·세션 변경, 파일당 100줄 초과.
