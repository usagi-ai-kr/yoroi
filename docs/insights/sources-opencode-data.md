# OpenCode Data 내부 참조 수집 (#102)

사용자 결정(2026-10-12): 내부 전용이라 수집한다. 약관(Aug 15, 2026 발효)의 자동 추출·crawl/scrape 금지에
내부 예외가 없다는 점은 유지되며, **리스크는 사용자가 수용**했다. 따라서 우회는 하지 않고 "예의 있는 수집"만 한다.

## 정책 (구현 계약)

- 운영 흐름은 공개 JSON(`https://opencode.ai/data/index.json`) **1회 요청**(#80 기록 주소 고정 — 페이지를 찾지 않으므로 cheerio 불필요, HTML 파서는 구조 확인 전 fallback으로만 유지). ky 전송·retry 0·timeout·연락처 UA·401/403/429/5xx 즉시 SourceError.
- User-Agent: `yoroi/<version> (+https://github.com/qus0in/yoroi; internal reference, once daily)` — 연락처 포함.
- timeout 15s, 리다이렉트 오류 처리. 429·403·401·5xx·차단/캡차 페이지면 **즉시 중단, 재시도 0**, SourceError 보고.
- 하루 1회(같은 KST 날짜 재사용), 원문 저장 금지 — 정규화 지표만 SQLite에 저장한다.
- 금지: UA 위장·브라우저 흉내 헤더·프록시/IP 교체·차단 후 재시도·지연 무작위화(탐지 회피).

## JSON 키 구조 (2026-10-12 1회 조회, 값·모델명 원문 저장 없음)

- root: `page`(string), `updatedAt`(string), `summary`(string), `leaderboard`{`pastWeek`(array<object>, 18), `pastDay`(array<object>, 18)}, `dailyTokens`(array<object>, 56)
- `dailyTokens[]`: `date`(string), `total`(number), `models`(object — 키는 모델명(개수만 기록, 원문 미저장), 값 number)
- 채택 흐름: **JSON 1회만**. 주소를 #80 기록으로 고정해 페이지 조회가 필요 없고, `dailyTokens`에서 모델별 토큰 사용량·`updatedAt`을 얻는다.
- 미확보(TODO): **리더보드 키는 다음 수집 진단으로 확보 후 파서 추가**한다. 진단은 `opencode-data: schema pastWeek[n=…,키:타입…], pastDay[…]; updatedAt=ISO-UTC|…` 형식의 stderr 1줄로, 키 이름·값 타입·요소 수·형식만 담고 값·모델명·수치 원문은 출력·저장하지 않는다. updatedAt은 확보 전까지 ISO 형태만 채택.

## 수집 내용

- 페이지: https://opencode.ai/ko/data (1회 조회). 표에서 모델별 `opencode_data_rank`(순위)·`opencode_data_tokens`(토큰 사용량)·`opencode_data_share`(점유율, %)와 `updatedAt`을 파싱.
- 출처 표기: "OpenCode Data (내부 참조 · 약관상 자동 추출 제한)", 인용 안내에 `updatedAt` 사용.
- 참고 열 반영은 렌더 소유자(agy1·ollama) 몫 — 이 패킷은 `readOpenCodeDataReference` 조회 함수만 제공.

## 의존성·라이선스

- ky 2.2.0 — MIT. cheerio 1.2.0 — MIT. (pnpm add, 2026-10-12. package.json/lock에 기록)
- cheerio는 **운영(JSON) 경로에서 쓰지 않는다** — HTML fallback 파서(`opencode-data-parser.ts`, 리더보드 표 구조 확인 전 진단·테스트) 전용이라 최소 의존성으로 유지한다. 구조 확인이 끝나면 fallback과 함께 제거를 검토한다.

## 한계

- 파서는 표 구조 변경 시 빈 결과(empty 실패)로 끝낸다. 추측 파싱 없음.
- 페이지 updatedAt 표기가 없으면 `sourceAsOf`는 수집일로 두고 metadata.updatedAt은 생략한다.
