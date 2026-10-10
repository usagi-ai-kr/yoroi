# 소스 C 조사: Cognition FrontierCode

조사 일시: 2026-10-10 (UTC). 설명 페이지·JSON·robots·약관을 각 1회 읽었다. 로그인·키·대량 요청 없음.
사용자 결정(2026-10-10): 내부 전용 사용으로 0.4.0 모니터링 범위에 추가.

## 접근·인증

| 항목 | 내용 | 근거 URL |
| --- | --- | --- |
| [확인] 설명 페이지 | FrontierCode 리더보드. FrontierCode 1.1(현재)·1.0 revision, 방법론·changelog·예시 태스크 | https://cognition.com/frontiercode |
| [확인] 데이터 JSON | `GET https://cognition.com/data/frontiercode-leaderboard/data.json`, `application/json`, 무인증 | https://cognition.com/data/frontiercode-leaderboard/data.json |
| [확인] robots | `User-agent: *` `Allow: /`, `Disallow: /downloads/`. `/data/` 경로 허용 | https://cognition.com/robots.txt |
| [미확인] 공식 API | 문서화된 REST/쿼리 API 없음. 공개 JSON이 유일 경로 | — |

## JSON 구조·필드

- 최상위 키: `v1`, `v1_1` (두 revision).
- 각 revision 키:
  - `models`: 모델 이름 배열
  - `colors`, `lab_colors`: 모델·랩 → hex 색상
  - `harness`: 모델 → 실행 harness (`claude-code`, `codex`, `mini-swe-agent`, `chisel`, `gemini-cli`, `grok-build`, `cursor-cli`, `devin`)
  - `efforts`: 모델 → reasoning effort 배열 (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`)
  - `subsets`: `{ main: 100, extended: 150 }`
  - `data`: 모델 → effort → subset(`main`/`extended`) → 지표 객체
- 지표 객체 필드: `correct`(0–1), `new_score`(0–1), `tokens`(수), `cost`(USD), `ote`(null). v1_1 일부에 `duration_min`, `tool_calls`, `steps`, `flagged_rate`(0–1). 없는 값은 `null`.
- [미확인] JSON에 갱신 시각·revision 발행일 필드 없음. 페이지 changelog 날짜(최신 Oct 7, 2026), revision 날짜(1.1=07.07.26, 1.0=06.08.26)로만 근사.

## 약관·라이선스

- [확인] Website Terms of Use(Last updated May 13, 2024) §3.1: Content는 "personal use only"로 제공. 상업적 목적의 복제·집계(aggregated)·재배포·전송·판매는 사전 서면 허가 없이 금지. 출처: https://cognition.com/legal/website-terms-of-use
- [확인] 별도 오픈 데이터 라이선스 없음. JSON 라이선스 미명시.
- [미확인] 자동 수집(스크래핑)의 명시적 허용/금지 조항은 확인 못 함. robots는 `/data/` 허용.
- 사용자 결정: 내부 전용(비상업) 사용으로 범위 추가. 재배포·상업적 이용 없음.

## 0.4.0 레코드 매핑 초안 (src/insights/record.ts)

- `source`: `'cognition'` (현재 `InsightSource` 유니온에 없음 → 코드에서 추가 필요, 이 패킷 범위 아님)
- `modelId`: JSON 모델 키 (예: `Claude Opus 5.5`)
- `metric`: `correct` | `new_score` | `cost` | `tokens` | `duration_min` | `tool_calls` | `steps` | `flagged_rate`
- `value`: 숫자. `unit`: `ratio`(correct/new_score/flagged_rate) | `usd`(cost) | `tokens` | `min` | `count`
- `category`: `{revision}/{effort}/{subset}` (예: `v1_1/high/main`)
- `observedAt`: 수집 시각. `sourceAsOf`: [미확인] (JSON 갱신 필드 없음)
- `sourceUrl`: data.json URL. `sourceName`: `Cognition FrontierCode`
- `license`: `null`(내부 전용). `method`: `official-dataset`
- 주의: `correct`·`new_score`는 mergeability 벤치마크로 Arena 선호·AA 지표와 별개. 합산 금지.

## 미확인

- JSON 갱신 시각·스키마 버전 계약·이전 revision 보존 기간
- 자동 수집에 대한 약관상 명시적 허용/금지
- JSON 키 구조 변경 시 하위 호환 정책
