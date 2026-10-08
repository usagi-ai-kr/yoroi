# Ollama Cloud 사용량 계약 (#13, #18)

- 확인일: 2026-10-07. 사용자 지시에 따라 비공식 직접 API를 사용한다.
- `GET https://ollama.com/api/usage?ts=<unix-seconds>`는 OpenUsage에서 사용하는 조회 경로다.
- 2026-10-08 실제 계정 확인: usage는 기간별 집계, `/api/balance`는 구독·구매 잔액을 반환한다.
  참조 구현의 이전 limits 구조와 달라 두 형태를 구분해 지원한다.
- 공식 지원 계약이 아니며 변경 시 parse 오류로 처리한다. 공식 대안은 CLI `ollama`의 대화형
  표시뿐이라 자동 수집에 쓰지 않는다. 실패는 공급자 오류로 격리하고 다른 공급자를 막지 않는다.
- 근거: [OpenUsage 설명](https://github.com/robinebers/openusage/blob/cb21465e3d88d8b2075ca48d38c936b82177fb78/docs/providers/ollama.md),
  [키 파서](https://github.com/robinebers/openusage/blob/cb21465e3d88d8b2075ca48d38c936b82177fb78/Sources/OpenUsage/Providers/Ollama/OpenSSHEd25519Key.swift),
  [클라이언트](https://github.com/robinebers/openusage/blob/cb21465e3d88d8b2075ca48d38c936b82177fb78/Sources/OpenUsage/Providers/Ollama/OllamaUsageClient.swift).

## 인증

- OpenUsage 방식의 키는 Bearer API 토큰이 아닌 로컬 Ed25519 서명 키다.
- 기본 `$HOME/.ollama/id_ed25519`, `YOROI_OLLAMA_PRO_SIGNING_KEY_PATH`로 변경한다.
- `ollama signin`으로 계정에 등록된, 암호화되지 않은 단일 OpenSSH Ed25519 키를 읽는다.
- `GET,/api/usage?ts=<unix-seconds>`를 서명한다. 별도 OAuth scope는 확인되지 않아 미검증으로 둔다.
- `Authorization: <SSH-public-blob-base64>:<Ed25519-signature-base64>`와 JSON Accept를 보낸다.
- 개인 키는 전송하지 않는다. 파일 누락·암호화·손상·공개키 불일치는 authentication 오류다.
- 서버 프로세스도 실행 계정의 키 경로와 권한을 사용한다. 브라우저에 키를 전달하지 않는다.

## 응답과 매핑

```json
{
  "limits": {
    "session": { "usage": 0.349 },
    "weekly": { "usage": 0.316 },
    "monthly": { "usage": 0.053 }
  },
  "activity": { "cost": "1.25000" }
}
```

- 예시는 실제 필드 구조를 보존한 합성 수치다.
- 이전 `limits.usage`는 0–1 비율이며 `percent`로 변환한다. 범위·형식 위반은 parse 오류다.
- 이전 응답의 누락/null 창은 생략하며 빈 `limits`도 데이터 없음으로 보존한다.
- `activity.cost`는 4주 비용의 십진 문자열이며 USD used로 매핑한다. 한도는 추정하지 않는다.
- API에 없는 reset 시각은 생성하지 않는다. 계정 plan 조회는 현재 도메인에 필요하지 않아 생략한다.
- 401/403은 authentication, 기타 비200은 unavailable, HTTP timeout/network/cancel은 기존 경계를 따른다.

## 현재 응답 (실계정 필드·자료형 확인, 예시는 합성값)

```json
{
  "range": "7d", "scope": "self", "granularity": "day",
  "totals": { "request_count": 4, "usage_usd": 1.25,
    "input_tokens": 100, "cached_input_tokens": 20, "output_tokens": 30 },
  "buckets": []
}
```

- range를 창 ID에 보존하고 requests/USD/tokens 단위의 used를 매핑한다.
- 집계 응답이면 서명된 `GET /api/balance?ts=...`도 조회한다.
- `included.balance_usd` → remaining, `allowance_usd` → limit, 차액 → used.
  balance가 allowance보다 크면 차액과 percent는 추정하지 않는다.
- `included.period.from`은 구독 크레딧 기간 시작, `period.until`은 갱신 시각이다.
  until → resetAt, from → periodStart(ISO)로 보존한다. 무효 문자열은 parse 오류다.
  legacy `monthly`는 응답에 시작 필드가 없어 역산으로 계산한다.
- `purchased.balance_usd`는 구매 크레딧 remaining이다. 한도·사용률은 생성하지 않는다.

## domain 매핑 (UsageSnapshot)

| domain | 출처 | 비고 |
| --- | --- | --- |
| provider/observedAt | 고정 `ollama-pro` / source 실행 시각 | 서명 URI와 동일 ts |
| windows[].id | legacy 키·`activity:{range}:{metric}`·`credits:*` | 중복 id 불가 |
| used/remaining/limit/percent | limits·totals·balance 필드 | 없는 값 생성 안 함 |
| resetAt / periodStart | `included.period.until` / `.from`만 | legacy·purchased에는 없음 |
| 누락 | legacy resetAt·purchased 한도·rate limit 헤더 | 추정 않고 미검증 표기 |

## 상태 코드와 rate limit

- 401/403 → authentication, 그 외 비200 → unavailable로 정규화한다.
- 429(rate limit)는 문서로 확인되지 않았다. 429는 기존 비200 경로로 unavailable 처리하며
  실측 전까지 미검증으로 표기한다. Retry-After 등 rate limit 헤더는 사용하지 않는다.
- 오류 응답 본문은 파싱·로그·오류 메시지에 포함하지 않는다.

## 구현과 검증

- `src/infra/ollama-source.ts`, `ollama-parser.ts`, `ollama-key.ts`.
- 합성 응답·생성 Ed25519 키로 서명 검증, 키 손상·HTTP 실패·누락 창·파싱 오류를 검사한다.
- fixture: `tests/fixtures/ollama-usage-limits.json`(legacy limits+activity.cost),
  `ollama-usage-current.json`(range/totals), `ollama-balance.json`(included period·purchased),
  `ollama-error.json`(오류 본문 비노출). 모두 개인 값 없는 합성값이다.
- 실제 Ollama 계정 조회 성공: 구독/구매 크레딧 2개·집계 5개, 총 7개 창 파싱.
  개인 응답·키 원문은 기록하지 않는다.

## CLI 표시 (출력 전용 규칙, 수집 데이터 불변)

- 표시: `monthly`·`credits:included`(월간 인정, `included.period.until` 리셋). `credits:purchased`는 계속
  수집하지만 기본 출력(pretty·plain)에서는 제외해 기본 표시는 월간 `m`(`credits:included`)만 남는다.
  숨김: `activity:*` 전부, 이전 `session`·`weekly`. 표시 대상이 0개면 창 0개에
  plain `windows=0 (N windows hidden)`·pretty `(none)` 행으로 안내하고 전체 폴백은 하지 않는다.
- 표기: `monthly`·`credits:included` → `m`. 계산(월간 판정·예상 비율)에는 내부 id를 그대로 쓴다.
- `credits:included` 예상 비율은 파서가 보존한 `included.period.from`(periodStart) 시작점 기준이며,
  없거나 무효·reset 이후면 숨긴다. legacy `monthly`는 응답에 시작 필드가 없어 기존 역산을 유지한다.
- 합성 예시: `ollama-pro: ok observed=2026-10-08T00:00:00Z windows=1` 뒤에
  `  - m [USD] usage_status=n/a used=unknown remaining=1.25 limit=5 percent=unknown …`처럼 표시한다.
