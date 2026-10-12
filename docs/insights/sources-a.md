# 소스 A 조사: Artificial Analysis · OpenRouter Rankings · OpenCode Data

조사 일시: 2026-10-10 (UTC). 공개 문서·약관·robots.txt만 확인. API 키·로그인·대량 크롤링 미사용.

## 요약 표

| 소스 | 공식 API/데이터셋 | 인증 | 비용·tier | 재사용·인용 조건 | robots.txt | 수집 가능 필드 | 근거 URL | 미확인 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Artificial Analysis | V2 API (`/api/v2/language/models/free`, `/api/v2/language/models`) | API key (`x-api-key` header) | Free 100 req/24h, Pro 500 req/24h, Commercial custom | 모든 tier attribution 필수 (byline/footer link). Terms of Use + Data Platform Terms 적용 | `Allow: /` (전체 허용) | intelligence/coding/agentic index, capability indices, pricing (input/output/cache), performance (tokens/s, TTFT, e2e), release_date, model_creator | [API docs](https://artificialanalysis.ai/data-api/docs), [Terms](https://artificialanalysis.ai/docs/legal/Terms-of-Use.pdf), [robots](https://artificialanalysis.ai/robots.txt) | Commercial tier 범위, 재배포 권리 세부 조항 |
| OpenRouter Rankings | `GET /api/v1/datasets/rankings-daily` | Bearer token (OpenRouter API key) | 30 req/min/key, 500 req/day/account | CC BY 4.0. 재배포·상업적 이용 가능, attribution 필수: `Source: OpenRouter (openrouter.ai/rankings), as of {as_of}.` | `Disallow: /seo/` 외 전체 허용 | date, model_permaslug, total_tokens (prompt+completion), meta.as_of, start_date, end_date, version | [API reference](https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily), [robots](https://openrouter.ai/robots.txt) | 정확한 비용 정책 (무료 사용 가능 여부는 rate limit만 명시) |
| OpenCode Data | 공식 API 없음. JSON: `https://opencode.ai/data/index.json` | 불필요 | 무료 | 명시적 라이선스 없음. Citation 지침: "Cite OpenCode Data (opencode.ai/data) with the update time" | `Disallow: /s/`, `/share/` 외 전체 허용 | top models (7일/일일), daily tokens by model, unique users, weekly retention, session cost, token prices, cache ratio, market share by lab, top countries | [Data 페이지](https://opencode.ai/ko/data), [robots](https://opencode.ai/robots.txt) | 재배포·재사용 명시적 조건, 데이터 보존 기간 |

## 세부 사항

### Artificial Analysis

- Free tier는 headline indices + capability indices + median performance + pricing만 제공. Pro+는 per-benchmark scores, full pricing, percentiles 추가.
- Rate limit: 24h 고정 윈도우. `X-RateLimit-Reset`으로 정확한 리셋 시각 확인. 429 시 `Retry-After` 제공.
- 모델 식별: `slug` (예: `gpt-oss-20b`). `openrouter_api_id` 필드로 OpenRouter ID 매칭 가능 (Pro+).

### OpenRouter Rankings

- 데이터셋 시작일: 2025-01-01. 이전 날짜 요청 시 해당 날짜로 클램프.
- `period=day` (기본), `week`, `month` 지원. `category`/`language_type` 필터는 샘플링 데이터셋으로 주간 추정치.
- 토큰 계산: 각 upstream provider의 tokenizer 기준. 모델 간 직접 비교 불가.

### OpenCode Data

- 페이지 내 JSON 링크 제공: `https://opencode.ai/data/index.json`. 별도 인증 없이 접근 가능.
- 집계 주기: 시간별. 일/주 단위는 UTC 기준.
- 사용자/세션: 근사치 (distinct users, OpenCode sessions).
- 비용: 세션 평균 비용 + 모델 catalog list price.

## 2026-10-12 최신 override — AA·OpenRouter 상위 50 (사용자 승인, [top50-decision.md](top50-decision.md))
- 구 상위 20 결정(2026-10-11)은 역사로 보존하며, 전 소스 수집·순위창이 상위 50(rank<=50)으로 갱신됐다.
- AA: free tier 4쪽 전체 수집 후 `coding_index` 상위 50과 `intelligence_index` 상위 50의 합집합(동점 포함) 저장, requestScope `aa-v2:free:language-models:coding-intel-top50`.
- OpenRouter: 비교일별 `total_tokens` 상위 50(동점 포함) 보존, requestScope `rankings-daily:day:top50`. (Arena `overall-top50` 연계).
- 레터: 기본 출력은 Top 10 압축 레터(오케스트레이터·워커 Top10, Arena/OR 참고 순위 표기), `--full` 옵션 시 50개 전체 상세 레터를 보존한다. 스코프 갱신으로 전환일 비교는 의도적 '이전 기록 없음'.
