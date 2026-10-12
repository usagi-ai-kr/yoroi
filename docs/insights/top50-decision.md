# 상위 50 수집 결정 (2026-10-12 사용자 승인)

기존 상위 20 설계(0.5.1)를 상위 50으로 확장한 결정과 계약 변경을 기록한다. 렌더러·letter.ts는 이 패킷 소유가 아니며 수정하지 않았다.

## 소스별 선택 규칙

- **Arena**: config=text/split=latest의 overall 블록 rank≤50(50위 동점 포함). **첫 응답 100행 안에서** rank 51(또는 non-overall) 경계가 확인되어야 성공하며, 경계가 없으면 2쪽을 추가로 가져오지 않고 unavailable이다(잘린 상위 50을 성공으로 반환 금지). policy maxRequests 2는 429/5xx 재시도 1회 포함 상한으로만 쓴다. rank 역전·무효 rank도 그대로 unavailable.
- **Artificial Analysis**: coding_index 상위 50과 intelligence_index 상위 50의 **합집합**(각 컷오프 동점 포함)에 속한 모델의 모든 metric 보존. 4쪽 완전성 규칙(partial/truncated → unavailable) 유지.
- **OpenRouter**: 비교일별로 total_tokens 상위 50(동점 포함)을 선택하고 날짜별 결과를 모두 보존한다. 최신 기준일 top50은 표시 경로, 비교일별 top50은 history(rank 코호트) 경로에 쓴다.
- **Cognition**: `correct` 기준 상위 50. 파서가 category에 `revision/effort/subset`을 담으므로 **category별로** 상위 50을 뽑아 합집합한다(서로 다른 revision/effort/subset 점수를 섞지 않음; ties는 컷오프 값 동점 전체 포함). 모델의 다른 metric은 유지.

## rank 코호트·창(window)

- windowSize는 20→50으로, **Arena/AA뿐 아니라 전 소스**에 적용한다(모든 소스가 상위 50 수집으로 바뀌었으므로 진입/이탈 라벨이 소스별로 갈리지 않게 함).
- AA는 coding과 intelligence 두 코호트를 실제 배선한다(RANK_COHORTS.extraMetrics).
- OpenRouter처럼 한 daily에 여러 비교일이 들어오는 소스는 **최신 비교일 행만** 현재 순위 코호트로 쓰고, previous는 저장된 전일 daily에서 **정확히 하루 전 비교일 행**만 사용한다(없으면 n/a, 추정·보간 금지).

## requestScope 변경(의도된 리셋)

- arena `hf-rows:text:latest:overall-top50`
- AA `aa-v2:free:language-models:coding-intel-top50`
- OpenRouter `rankings-daily:day:top50`
- Cognition `frontiercode:data-json:top50`

스코프가 바뀌므로 전환일 이전 기록과 분리되며, 당일 순위 비교는 `n/a: 이전 기록 없음`이 된다(의도된 리셋).

## 20→50 전환 테스트 목록(의도 변경)

- arena-transport/boundary/safety: rank 20/21/600/601 경계 → rank 50/51 기준으로 전환(첫 페이지 경계 목표). 구 '100행 rank20 동점 후 2쪽 경계 성공' 테스트는 '첫 쪽 경계 미확인 → unavailable(2쪽 미조회)'로 의도 변경, 429 재시도 정책 테스트는 유지.
- aa-top20.test.ts → top50 합집합 의미로 전환(소집합 전체 보존, coding 결측·intelligence 보유 모델 포함).
- rank-window.test.ts: windowSize 20→50, 진입/이탈 라벨 `상위 50`.
- composition/source-wiring fixture: Arena 21행 → 51행(50 수집 + 경계).
- 신규: insights-aa-top50.test.ts, insights-openrouter-top50.test.ts, insights-cognition-top50.test.ts, insights-source-top50.test.ts.

## 후속(반영 완료)

- `src/insights/letter.ts` 한계 노트는 상위 50으로 갱신되었고, 렌더링은 기본 Top 10 압축 레터(오케스트레이터·워커 Top 10) 및 `--full` 옵션 시 상세 레터 유지 체계로 구현됐다([letter-issue.md](letter-issue.md)).
- 문서 파일(`docs/insights/execution-contract.md`, `arena-transport.md`, `sources-a.md`, `sources-b.md`)도 100줄 상한을 준수하며 상위 50 및 기본 Top 10 레터 계약으로 정정을 완료했다.
