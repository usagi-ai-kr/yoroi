# Go/No-Go 결정: AI 인사이트 소스 (0.5.0)

> 버전 표기는 2026-10-11 재번호로 `0.5.0`(milestone #7)로 갱신했다. 아래 Go/No-Go **결정 내용과 조사일은 2026-10-10 기록 그대로**다.

기준: [#70](https://github.com/qus0in/yoroi/issues/70) 완료 기준 1번 + [sources-a.md](sources-a.md) + [sources-b.md](sources-b.md) + [sources-c.md](sources-c.md) + p3/pA 브리프. 조사일 2026-10-10.

판정 기준: **공식 API/데이터셋 + 명시적 재사용 라이선스 + 무인증이면 Go, 공식 경로는 있으나 키·라이선스·약관 조건이 남으면 조건부, 약관상 자동 추출 금지·공식 경로 부재·약관 미확인이면 보류.**

## 소스별 결정 (사용자 최종 결정 반영)

| 소스 | 결정 | 핵심 근거 | 근거 URL |
| --- | --- | --- | --- |
| Arena | **Go** | 공식 HF 데이터셋(CC-BY-4.0), 무인증, 재배포 가능. 사이트 스크래핑은 약관 금지 → HF만 사용 | [HF dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset), [Terms](https://arena.ai/terms-of-use) |
| Artificial Analysis | **Go (키 설정 완료, [#79](https://github.com/qus0in/yoroi/issues/79))** | 공식 V2 API + Free tier(100 req/24h). API key `.env` 설정 완료, attribution 필수. robots 전체 허용 | [API docs](https://artificialanalysis.ai/data-api/docs), [Terms](https://artificialanalysis.ai/docs/legal/Terms-of-Use.pdf) |
| OpenRouter Rankings | **Go (키 설정 완료, [#79](https://github.com/qus0in/yoroi/issues/79))** | 공식 API 존재, CC BY 4.0로 재배포 명시적 허용. API key `.env` 설정 완료 | [API ref](https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily) |
| Cognition FrontierCode | **Go (내부 전용, 사용자 결정 2026-10-10)** | 공개 JSON(무인증)·robots `/data/` 허용. 약관 §3.1은 personal use 한정·상업적 재배포 금지 → 내부 전용으로만 사용 | [JSON](https://cognition.com/data/frontiercode-leaderboard/data.json), [Terms](https://cognition.com/legal/website-terms-of-use) |
| OpenCode Data | **모니터링 제외 (결정 완료, [#80](https://github.com/qus0in/yoroi/issues/80))** | 이용약관 제한 5번 "automatically or programmatically extracts data"·11번 crawl/scrape 금지 → 0.5.0 수집 제외 | [약관](https://opencode.ai/legal/terms-of-service), [Data](https://opencode.ai/ko/data) |
| Vals AI | **모니터링 제외 (결정 완료, [#81](https://github.com/qus0in/yoroi/issues/81))** | 공식 API 부재, HTML 파싱 불안정, 약관 미게시 → 0.5.0 수집 제외 | [robots](https://www.vals.ai/robots.txt), [Index](https://www.vals.ai/benchmarks/vals_index) |

## 0.5.0 소스 (4곳 확정)

- **Arena** — 공식 HF 데이터셋(CC-BY-4.0), 무인증
- **Artificial Analysis** — 공식 V2 API, 키 `.env` 설정 완료
- **OpenRouter Rankings** — 공식 API, 키 `.env` 설정 완료
- **Cognition FrontierCode** — 공개 JSON, 내부 전용(재배포·상업적 이용 없음)

제외 2소스: **OpenCode Data**([#80](https://github.com/qus0in/yoroi/issues/80)), **Vals AI**([#81](https://github.com/qus0in/yoroi/issues/81)).

## 남은 결정·확인 항목

1. **API 키 보관·주입 정책** — `.env` 값의 CI/실행 환경 주입 방식(원문 커밋 금지)
2. **Yoroi 실행 명령·출력 계약** — Hermes cron 등록·실행·전달 대상은 코테츠 담당. Yoroi는 `once`형 실행 명령·stdout·exit code 계약만 제공
3. **Arena 데이터셋 갱신 주기** — 데일리 여부 미공지 → `leaderboard_publish_date`로 기준일 판단
4. **Cognition 갱신 시각** — JSON에 timestamp 필드 없음 → 페이지 changelog 날짜로 근사

## 미확인 항목

- Artificial Analysis: Commercial tier 범위, 재배포 권리 세부 조항
- OpenRouter: 무료 사용 가능 여부 (rate limit만 명시)
- OpenCode Data: 자동 추출 금지 예외·오픈 데이터 라이선스 (0.5.0 제외로 실사용 무관)
- Vals AI: 공개 약관·재배포 정책 미게시 (0.5.0 제외로 실사용 무관)
- Arena: 데이터셋 갱신 주기(데일리 여부) 미공지
- Cognition: JSON 갱신 시각·스키마 버전 계약, 자동 수집 약관 명시 여부
