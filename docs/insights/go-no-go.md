# Go/No-Go 결정: AI 인사이트 소스 (0.4.0)

기준: [#70](https://github.com/qus0in/yoroi/issues/70) 완료 기준 1번 + [sources-a.md](sources-a.md) + [sources-b.md](sources-b.md). 조사일 2026-10-10.

판정 기준: **공식 API/데이터셋 + 명시적 재사용 라이선스 + 무인증이면 Go, 공식 경로는 있으나 키·라이선스·약관 조건이 남으면 조건부, 공식 경로가 없거나 파싱 불안정·약관 미확인이면 보류.**

## 소스별 결정

| 소스 | 결정 | 핵심 근거 | 근거 URL |
| --- | --- | --- | --- |
| Arena | **Go** | 공식 HF 데이터셋(CC-BY-4.0), 무인증, 재배포 가능. 사이트 스크래핑은 약관 금지 → HF만 사용 | [HF dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset), [Terms](https://arena.ai/terms-of-use) |
| Artificial Analysis | **조건부 Go** | 공식 V2 API + Free tier(100 req/24h). API key 필요, attribution 필수. robots 전체 허용 | [API docs](https://artificialanalysis.ai/data-api/docs), [Terms](https://artificialanalysis.ai/docs/legal/Terms-of-Use.pdf) |
| OpenRouter Rankings | **조건부 Go** | 공식 API 존재, CC BY 4.0로 재배포 명시적 허용. API key 필요 | [API ref](https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily) |
| OpenCode Data | **조건부 Go (라이선스 미명시)** | 공식 API 없음, JSON(index.json) 무인증 접근. 명시적 라이선스 없고 citation 지침만 → 재사용 위험 | [Data](https://opencode.ai/ko/data), [robots](https://opencode.ai/robots.txt) |
| Vals AI | **보류** | 공식 API 부재, 공개 HTML 리더보드 파싱 불안정, 약관 미확인 | [robots](https://www.vals.ai/robots.txt), [benchmarks](https://www.vals.ai/benchmarks) |

## 0.4.0 MVP 포함·제외

**포함 (1소스):**
- **Arena** — 공식 데이터셋, 무인증, 명시적 라이선스(CC-BY-4.0)

**조건부 포함 (3소스, 사용자 결정 필요):**
- **Artificial Analysis** — Free tier 있으나 API key 발급 필요
- **OpenRouter Rankings** — API key 발급 필요, CC BY 4.0
- **OpenCode Data** — JSON 접근 가능하나 명시적 라이선스 없음 → 라이선스 위험 수용 필요

**보류 (1소스):**
- **Vals AI** — 공식 API 부재, HTML 파싱 불안정, 약관 미확인

## 사용자 결정 필요 항목

1. **Artificial Analysis API 키 발급 여부** — Free tier (100 req/24h)로 충분한지 확인
2. **OpenRouter API 키 발급 여부** — 500 req/day/account 제한 확인
3. **API 키 보관 방식** — CI/Hermes cron 환경 시크릿 주입·보관 정책
4. **OpenCode Data 라이선스 위험 수용 여부** — 명시적 오픈 라이선스 부재 상태에서 citation 지침만으로 파이프라인 탑재 승인 여부
5. **HTML 파싱 허용 원칙** — 공식 API/데이터셋 없는 소스를 1일 1회 최소 파싱 허용할지, 공식 경로 소스만 0.4.0 범위로 한정할지
6. **Hermes cron 계약** — 실행 주체(봇 계정)·cron 명령·출력/전달 채널·스케줄(Asia/Seoul) 확정
7. **Vals AI 포함 여부** — 약관 미확인·파싱 불안정 → 0.4.0 보류 유지 여부

## 미확인 항목

- Artificial Analysis: Commercial tier 범위, 재배포 권리 세부 조항
- OpenRouter: 무료 사용 가능 여부 (rate limit만 명시)
- OpenCode Data: 재배포·재사용 명시적 조건, 데이터 보존 기간
- Vals AI: 공개 약관·재배포 정책 미게시
- Arena: 데이터셋 갱신 주기(데일리 여부) 미공지
