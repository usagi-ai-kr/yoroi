# 후보 소스 검토: Nous·Vals·Arena (#141)

읽기 전용 공개 페이지 조회 + DB 잔여분 대조. 수집 구현·스크레이핑 없음.
관측과 미확인를 구분한다. 사용자 환경 일반화·전역 단정 없음.

## 후보 1 — Nous 벤치 리더보드: needs-user

관측(2026-10-19 `portal.nousresearch.com/bench`):

- 코딩 관련 분리 가능: TerminalBench 4·TerminalBench Science 열이
  모델별 점수·작업당 비용으로 노출된다. Hermes Bench는 150과제 중
  code review 포함이나 대부분 비코딩이라 제외해야 한다.
- 이름: 표시명+제작사(예 Claude Opus 5.5·Anthropic). effort 변형
  접미어 없음. 전 모델 단일 harness, effort high 고정 1회 측정.
- 문서화 API 없음(관측 범위 내). 페이지 직접 읽기가 유일 경로.
- 약관 미확인: `/terms` 조회 빈 응답. 푸터 MIT는 사이트 코드
  표기로 보이며 데이터 추출 조항 확인 불가. 갱신 주기 미확인.

판정: TB 두 열만 + 약관 확인 후. 약관·추출 경로 사용자 확인 필요.

## 후보 2 — Vals AI: needs-user

관측(2026-10-19 `vals.ai`):

- 코딩 벤치 분리 가능: 벤치별 독립 페이지·리더보드
  (vibe-code·code-migration·terminal-bench-4/2-1·ioi·cyber·
  srebench·programbench·emb·medcode). 모델 페이지는 벤치별
  점수·순위·비용을 함께 보인다.
- 이름: 슬러그(`anthropic_claude-sonnet-5-5`)+표시명. effort는
  본문 서술(max/high)이며 변형 접미어가 아니다.
- 공개 범위: 벤치·모델 페이지 전체 리더보드. 점수는 비공개
  테스트셋 기반(오염 내성, 독립 평가자 표방).
- 문서화 API 관측 없음. `/terms` 404, 푸터에 약관 링크 없음.
  추출 조항 미확인. 갱신 주기 미확인(10월 게시 빈번).

판정: 약관·추출 경로 확인 후 코딩 벤치 한정. 사용자 확인 필요.
주의: Terminal-Bench가 Nous와 중복된다. 둘 다 쓰면 같은 근거
이중 계상 → 한쪽만 또는 소스 상한 규칙이 먼저 필요하다.

## 후보 3 — Arena: collect (HF 문서화 경로, 계통 분리)

관측:

- 문서화 API 존재: HF `lmarena-ai/leaderboard-dataset`(CC-BY-4.0).
  `load_dataset` + category 필터 + latest/full 스플릿이 문서 예제에
  있다. 크롤링 불필요(`lmarena.ai` 직접 조회는 403 차단 관측).
- 코딩 분리 가능: `webdev`(Code Arena, 29.2k행)+`agent` 집계·
  신호별 서브셋(bash·tool_hallucination·task_outcome 등).
- 이름: `이름 (Effort)`(예 Claude Opus 5.5 (Max))로 저장소
  effort 접미어와 대응 가능. `(High, 20260813)` 같은 날짜형은
  정규화 규칙이 별도 필요. 발행일 2026-10-16 신선.
- DB 잔여 540행(최종 2026-10-08)은 overall 전용(category=overall,
  rank/rating 계열)이라 코딩 필터 수집과 모집단이 다르다.
  전일 비교선을 넘나들 수 없으니 신규 계통으로 취급한다.

판정: 수집. 범위 webdev+agent 코딩 서브셋, latest 스플릿,
기존 overall 행과 섞지 않는다.

## 공통

- 내부 전용·재배포 금지 전제. 새 소스는 성능 차원 추가 근거로만
  두고 기존 4소스 대체·재정렬은 하지 않는다(가중치는 별도 결정).
- 판단 적격: TB·Vals는 과제 완수율, Arena는 선호 투표다.
  같은 차원 내 근거로 합산하지 말고 출처를 분리 표기한다.
- 표준화 편입·부분 수집 표시는 수집 결정 뒤 설계에서 정한다.

## 미확인(사용자·후속)

- Nous·Vals 약관의 자동 추출 조항, 문서화 API 존재 여부.
- 세 소스 갱신 주기. Arena 날짜형 모델명 정규화.
- Vals·Nous 유료·인증 필요 여부(관측 범위 밖).
