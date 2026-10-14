# OpenCode Go 사용량 계약

- 확인일: 2026-10-07
- 대상: OpenCode Go
- 상태: 계약 확정 (#14 조사, #19 어댑터 구현 근거)
- 관련 이슈: `#14`, `#19`

## 1. 엔드포인트와 인증

- `GET https://opencode.ai/zen/go/v1/usage`
  - 인증: `Authorization: Bearer <OpenCode Go API key>` (`YOROI_OPENCODE_GO_API_KEY`로 주입)
  - 읽기 전용 사용량 조회이며 모델 호출(`/chat/completions`) endpoint가 아니다.
- 공식 근거:
  - anomalyco/opencode `dev` route: `packages/console/app/src/routes/zen/go/v1/usage.ts`
  - 응답 조립: `packages/console/core/src/subscription.ts` (`analyze*Usage`, `formatUsage`)
  - endpoint 추가 PR: anomalyco/opencode#16513
- [공식 조회 route](https://github.com/anomalyco/opencode/blob/dev/packages/console/app/src/routes/zen/go/v1/usage.ts)
  및 [공식 사용량 계산](https://github.com/anomalyco/opencode/blob/dev/packages/console/core/src/subscription.ts).
- 키 없는 실제 서버 요청이 401을 반환함을 확인했다(개인 키·계정 값 미사용).

## 2. 200 응답 계약

```json
{
  "usage": {
    "rolling": { "status": "ok", "percent": 4, "resetsAt": "2026-10-07T16:27:38.287Z" },
    "weekly": { "status": "ok", "percent": 3, "resetsAt": "2026-10-14T00:00:00.287Z" },
    "monthly": { "status": "rate-limited", "percent": 100, "resetsAt": "2026-11-07T06:06:01.287Z" }
  }
}
```

- 공급자 단위 3개 윈도우(rolling 5시간·주간·월간)이며 **모델별 윈도우는 제공되지 않는다.**
- `status`: `ok | rate-limited`. `rate-limited`는 `percent = 100`과 같은 의미다.
- `percent`: 정수 0~100(사용률). 서버 계산은 `floor(min(100, usage/limit*100))`.
- `resetsAt`: ISO 8601. 서버가 `now + resetInSec`으로 생성한다.
- fallback: 누락/null 윈도우는 건너뛰고 나머지 윈도우로 스냅샷을 만든다.
  세 윈도우가 모두 빠지면 parse 오류다. `resetsAt` 누락은 reset 없이 허용한다.

| 응답 필드 | `UsageSnapshot` 매핑 |
| --- | --- |
| `rolling`·`weekly`·`monthly` 키 | window.id 그대로(모델별 윈도우 없음) |
| `status` | `ok`·`rate-limited`만 허용, 그 외 parse |
| `percent`(정수 0~100) | window.percent, unit은 `'percent'` 고정 |
| `resetsAt`(ISO 8601, 생략 가능) | window.resetAt(ISO), 누락 시 필드 없음 |

## 3. 오류 매핑

| HTTP | 서버 error.type | Yoroi `SourceError` |
| --- | --- | --- |
| 401 | AuthError(키 누락/무효) | authentication |
| 403 | EntitlementError(Go 구독 없음) | authentication |
| 429 | 레이트 리미트 | unavailable |
| 기타·5xx | - | unavailable |
| timeout/network | - | timeout/network |
| 200 파싱 실패 | - | parse |

- 오류 메시지·로그에 API 키나 응답 본문 원문을 남기지 않는다.

## 4. 구현과 검증

- 구현: `src/infra/opencode-go-source.ts`, `src/infra/opencode-go-parser.ts`
- fixture: `tests/fixtures/opencode-go-usage.json`(공식 route·PR 구조 기반 합성)
- 테스트: 401/403/429/기타, timeout/network, parse, 키 공백, 윈도우 fallback·reset을 fake HTTP로 검증

## 5. 남은 확인 항목

- 2026-10-08 `.env` 설정으로 실제 계정 조회 성공: rolling/weekly/monthly 3개 창 파싱.
- balance fallback 표현 필드는 미검증: Zen 크레딧 잔액은 이 endpoint에 없다(anomalyco/opencode#44189, 후속 범위).

## 6. 훅 설치 대상
- `node scripts/opencode-hook.mjs install --target v1|v2 --config-dir <경로>`: 기본 v1은 기존 엔트리·helpers, v2는 단일 파일만 설치한다. 대상 마커가 다르면 기본 거부하며 `--force`로 명시 교체한다.
- `status`는 설치 target을 표시하고 `uninstall`은 버전과 무관하게 yoroi 관리 마커 파일만 제거한다. [V2 플러그인·공유 설정 경로 근거](https://opencode.ai/v2/docs/migrate-v1/); 설치기에는 미문서 API 필드 의존성이 없다.
