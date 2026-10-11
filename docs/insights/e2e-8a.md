# 8-A 실제 데이터 E2E 실측 및 재검증 결과 기록

- 기준 계약: [docs/insights/execution-contract.md](execution-contract.md) 선택 8-A.
- 초기 4소스 실측: 2026-10-11 승인 하에 1회 수행 (`/tmp/yoroi-e2e8a.mts`).
- 2소스 진단 재검증: 2026-10-11 사용자 신규 위임에 따라 Arena/AA 각 1회 수행 (`/tmp/yoroi-two-source-probe.mts`).
- 제약 준수: 초기 4회 + 재검증 2회 총 6회 수행(승인 범위 밖 호출 0회, HTTP 재시도 0회), 429 0건, 원문 응답 미보존, 비밀값 미기록, sentinel 보존, DB 미생성(인메모리).

## 1. 초기 4소스 수집 결과 (총 4 HTTP 요청)

| 소스 | 상태 | HTTP | metrics | evidence_rows | rejected | auth | failure_code |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenRouter | collected | 200 (1회) | 1530 | 20 | 0 | present | - |
| Cognition | collected | 200 (1회) | 1530 | 20 | 20 | none | - |
| Arena | failed | 200 (1회) | 0 | 0 | 0 | none | unavailable |
| Artificial Analysis | failed | 200 (1회) | 0 | 0 | 0 | present | unavailable |

> [!NOTE]
> 독립 감사(pK)와 root 대조에서 계측 경로를 확인했다. OpenRouter와 Cognition의 1,530건은 각각 검증을 통과한 metric 수이며 모델 수가 아니다. Cognition은 20개 행 탈락(`rejectedRows=20`)으로 partial 수집 처리되었다.

## 2. Arena·AA 2소스 정밀 진단 재검증 결과 (각 1회 수행)

- **Arena 진단**: status=200, json_ok=true, html_flag=false, envelope=true, rows_count=100, num_rows_total=10974, partial_flag=false, date_invalid=0, date_distinct=1, failure=fetch, reason=unavailable, class=budget-pagination.
  - 원인: 1회차 100행(overall) 수신 후 num_rows_total(10974) 미도달로 루프가 page 2(offset=100) 조회를 시도했으나, 1회 시험 예산(`maxRequests: 1`)에 의해 차단됨.
- **Artificial Analysis 진단**: status=200, json_ok=true, html_flag=false, envelope=true, rows_count=200, page=1, total_pages=4, page_size=200, failure=fetch, reason=unavailable, class=budget-pagination.
  - 원인: 1회차 200행 수신 후 total_pages=4로 인해 page 2 조회를 시도했으나, 1회 시험 예산(`maxRequests: 1`)에 의해 차단됨.

## 3. 종합 판정 및 후속 연계

- 종합 판정: 코드 4소스 지원 및 부분 실패 표시는 정상 유지됨. 0.5.0 실측 검증 범위는 사용자 결정에 따라 단일 1회 호출로 동작하는 2소스(OpenRouter, Cognition 부분성공) 기준으로 정리를 완료하였으며, 0.5.0 자체는 미커밋 진행 중 상태임.
- Arena/AA의 다중 페이지 수집은 후속 이슈로 분리:
  - Arena: [#92](https://github.com/qus0in/yoroi/issues/92) (마일스톤 없음)
  - Artificial Analysis: [#93](https://github.com/qus0in/yoroi/issues/93) (마일스톤 없음)
- [#89](https://github.com/qus0in/yoroi/issues/89) 실환경 detect 스모크는 별도 승인 대기 유지.
- 0.4.0 tag/Release 재발행 금지 및 커밋 생성 금지 원칙 유지.

## 4. 0.5.1 상위 20 실검증 (2026-10-11 21:19:57–21:19:59 KST)

- **실행 개요**: HTTP 요청 총 5회(Arena 1회, AA 4회). 429 0건, 재시도 0회, 응답 원문 미보존(저장 0).
- **사전 탐색**: coding 지표 확인 목적 사전 2요청(statistics 엔드포인트 200 반환하였으나 계측 구조 미인식, filter 적용 시 transport-error 발생) 확인 후 본 수집 진행.
- **Arena 결과**:
  - overall 상위 20행 추출, 경계 조건 rank-above-top 정상 수집.
  - 게시일 2026-10-08 단일 확인, num_rows_total 10,974건 중 1회 호출로 상위 20건 확보 완료.
- **Artificial Analysis 결과**:
  - 4쪽 수집(각 200, 200, 200, 97행), page 파라미터 실지원 확인.
  - 중복 0건, 총 고유 모델 697개 중 coding_index 미제공 모델 439개 제외.
  - coding_index 기준 상위 20개 선택 완료(동점 모델 포함 실선택 21개).
