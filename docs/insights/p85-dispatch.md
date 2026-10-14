# p85 분배: 워커 AA 3지표 산식 구현 → 0.11.1 배포 → 레터 발행 (2026-10-14 사용자 확정)

사용자: "이 기준으로 발행 후 알려줘". 산식 세부(기본 37.5/12.5/50)와 버전 0.11.1 patch는 사용자가 확정했다.
o는 분배만 맡는다. 결과: `scratch/reports/yoroi-p84-mimo-aa-observed.md`(통합 최종 갱신). 근거: `yoroi-p84-mimo-aa-observed-x2.md`(X2).

## 확정 산식 (워커만, 오케 82/6/12 불변)

- 기본 점수 = 100 × (0.375·성능 + 0.125·속도 + 0.5·가격). 사용량은 기본 차원에서 빠지고 가산으로 옮긴다.
  - 성능: AA `artificial_analysis_intelligence_index`. 하한은 원값 33이다(후보·▽ 보충 자격 모두). 표준화 하한 0.70은 워커에서 폐지한다.
  - 속도: 현행 AA tok/s 유지.
  - 가격: `intelligence_index_cost_per_task`·`intelligence_index_total_cost`를 각각 log 역방향 min-max한 뒤 평균한다. 하나만 있으면 그 값을 쓴다.
    둘 다 없으면 현행 혼합 단가 정규화로 대체하고, 표시에 `*`(대체) 표기를 단다.
  - 성능 intel이 없으면 후보에서 제외한다(기본 근거 결측).
- 가산 = 5 × mean(있는 것만: FrontierCode `correct` 표준화, OR·OCD 사용량 표준화). 없으면 0이고 탈락시키지 않는다. 최대 +5점이다.
- 원단위 합산은 금지한다. 모델명 조건도 금지한다. mimo-v2-6-flash·pro는 분리하고, mimo-v2-5 배제는 유지한다.
- effort: 현행 "base 내 대표 effort 선택" 규칙을 유지한다. 변경 시 결과가 달라지므로(X2 §5) 보고만 한다.

## 단계 (앞 단계 보고를 o가 확인한 뒤 다른 워커로)

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| I1a | w2 | 점수 코어: `config/score-weights.json`(worker 0.375/0.125/0.5 + bonus cap 5), `letter-top10-score*.ts`(소스·하한·가격 평균·대체·가산), 관련 tests. X2 추천 Top10과 일치 확인 | yoroi-p85-i1a-report.json |
| I1b | I1a 뒤 w1 | 표시·문서: 워커 차원 열(성능/속도/가격 + 가산), 표시 안내·산출 공식 문구, `*` 대체 표기, docs(score-weights·four-source-score·top10-scoring·letter-issue) | yoroi-p85-i1b-report.json |
| RV | I1a·I1b 외 | 리뷰·typecheck·전체 test·validate | 배정 시 |
| K | RV 뒤 | 주제별 커밋(p77~p85 미커밋분 포함, 남의 작업 혼입 금지), 0.11.1 범프·roadmap, dev push·PR | 배정 시 |
| D | K 뒤 다른 워커 | PR CI·머지·main CI·tag v0.11.1·Release·전역 CLI 0.11.1 확인 | 배정 시 |
| L | D 뒤 | 전역 CLI 0.11.1로 렌더 → #138 본문 갱신·댓글, 재조회로 AA 지표·가산·Free/워커 표 확인 | 배정 시 |

## I1a 결과 (w2, o 확인)

- 확정 산식 구현: config worker 0.375/0/0.125/0.5 + workerBonusCap 5. 멤버십은 X2 §4 집합과 같다. 오케 Top10은 바이트 단위로 동일하다.
- 947/947, typecheck 0, validate PASS. 기존 플레이크 usage-history 100ms가 1건 나왔다.
- 범위 확대 인정: `tests/helpers/dimension-reference.ts`·`insights-free-section`·`insights-markdown`·`insights-top10-render` 테스트 기대값. 산식 변경으로 필연이고 w2 pane에서 사용자 승인을 받았다.
- 남은 표시 문구(legend·formula '워커 성능<0.7' 등)는 I1b 몫이다.

## 최신 사용자 지시 (2026-10-14, #138 갱신 지시 대체)

- 0.11.1 실제 출시 후 새 레터 이슈를 발행하고 #142를 종료한다.
- 새 이슈 발행 뒤 #142를 닫는다. `gh issue create --title "[letter] 2026-10-14 AI 인사이트 레터 (p85)" --body "$(yoroi insights once --markdown)" --label letter`
- L 단계 전역 CLI 0.11.1로 렌더하고, #138 갱신 지시는 이 절차로 대체된다.

## 회고 (2026-10-14)

- **totalcost 필터 누락 해결**: 독립 리뷰(w2 cross-code)에서 AA total cost가 release scoring 입력과 candidate 경로에 연결되지 않은 누락 발견. 회귀 test(`insights-original-price-wiring.test.ts`) 추가로 해결. 테스트 950/950 통과.
- **AA 최신 수집 실패**: 2026-10-14 AA API 접근 시 HTTP 429 (Rate limit exceeded). 다른 3소스(OpenRouter, Cognition, OpenCode Data)는 최신 수집 성공. 확정 관측 snapshot 사용.
- **새 레터 발행**: 0.11.1 실제 출시 후 새 레터 이슈 발행 진행 중. `gh issue create --title "[letter] 2026-10-14 AI 인사이트 레터 (p85)" --body "$(yoroi insights once --markdown)" --label letter`

## 공통 금지

main 직접 push, 실제 API 호출·`--refresh`, 모델명 조건, 모델·세션 변경, 시크릿 노출, 소유 밖 수정, 파일당 100줄 초과.
