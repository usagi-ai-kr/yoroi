# 0.2.0 Hono REST API · WebSocket · 보안 계약 (#42·#43, 설계 초안)

> 준비 단계: 설치·구현 금지. 근거: #30, #31(아키텍처), #39·#40(장애·상태), #44(WS).

## 1. Hono REST 엔드포인트 및 라우팅 패턴

Hono 공식 `zValidator`(@hono/zod-validator) 미들웨어 패턴을 사용해 쿼리·바디 런타임 검증을 적용한다.

- `GET /api/v1/health`: 프로세스 및 DB 연결 상태 (`ok` | `degraded`)
- `GET /api/v1/usage/latest`: 전 공급자 최신 스냅샷 요약 (메모리/TTL 캐시 우선 읽기)
- `GET /api/v1/usage/history`: SQLite 과거 이력 조회 (쿼리: provider, from, to, limit)
- `GET /api/v1/providers`: 공급자 5종 상태·신선도(`stale` 여부)·마지막 성공 시각 조회
- `GET /api/v1/events`: WebSocket 핸드셰이크 엔드포인트 (변경 신호 스트림, #44)

## 2. Zod 요청·응답 스키마 초안

```ts
// 공급자 식별자 및 상태 (0.1.0 domain 및 failure-policy.md 정합)
export const ProviderIdSchema = z.enum(["ollama-pro", "opencode-go", "codex", "agy", "claude"]);
export const ProviderStateSchema = z.enum(["ok", "fetching", "error", "needs-login", "stale"]);
export const ErrorCodeSchema = z.enum(["authentication", "network", "timeout", "not-installed", "parse", "exit", "unavailable"]);

// /api/v1/usage/latest 응답
export const LatestUsageResponseSchema = z.object({
  observedAt: z.string().datetime(),
  items: z.array(z.object({
    provider: ProviderIdSchema,
    status: ProviderStateSchema,
    snapshotAt: z.string().datetime().nullable(),
    metrics: z.array(z.object({
      windowId: z.string(), percent: z.number().nullable(),
      used: z.number().nullable(), limit: z.number().nullable(),
      resetAt: z.string().datetime().nullable(), resetIn: z.string().nullable(),
    })),
    lastErrorCode: ErrorCodeSchema.nullable().optional(),
  })),
});

// /api/v1/usage/history 쿼리 및 응답
export const HistoryQuerySchema = z.object({
  provider: ProviderIdSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export const HistoryResponseSchema = z.object({
  items: z.array(z.object({
    id: z.number(), provider: ProviderIdSchema, windowId: z.string(),
    recordedAt: z.string().datetime(), percent: z.number().nullable(),
    used: z.number().nullable(), limit: z.number().nullable(), resetAt: z.string().datetime().nullable(),
  })),
});

// /api/v1/providers 응답
export const ProvidersResponseSchema = z.object({
  providers: z.array(z.object({
    id: ProviderIdSchema, status: ProviderStateSchema,
    lastSuccessAt: z.string().datetime().nullable(),
    lastErrorCode: ErrorCodeSchema.nullable(), isStale: z.boolean(),
  })),
});
```

## 3. WebSocket 변경 알림 계약 (`/api/v1/events`, #44)

- **페이로드**: 경량 변경 신호만 전송 (`{ type, provider?, at, version }`). 원문 데이터·토큰 미포함.
  - 이벤트 종류: `usage.collected` (전체 갱신), `usage.partial` (부분 실패), `auth.expired` (인증 만료), `usage.resetChanged` (리셋 변경).
- **소비 규칙**: 클라이언트는 WS 신호 수신 시 REST API(`latest`/`providers`)를 통해 상태를 재동기화한다.
- **Upgrade 없는 GET**: `Upgrade: websocket` 없으면 `426` + JSON 오류(`{ error: "upgrade-required" }`). `GET`과 WS는 동일 경로 공유, 동작은 헤더로 분기.

## 4. 접근 보안·바인딩·Origin 및 타임아웃 정책 (#43)

- **네트워크 바인딩**: 기본 `127.0.0.1` 루프백 바인딩. 외부 노출은 리버스 프록시 또는 명시적 호스트 설정 필수.
- **CORS / Origin 제어**: Hono `cors()` 미들웨어로 엄격한 Origin 제한. 개발 환경(`localhost:5173`) 외 비허가 Origin 거부.
- **핸드셰이크·인증 일관성**: REST 및 WebSocket 연결 시 동일한 인증 토큰/세션 헤더 검증 적용 (실패 시 401 반환 및 WS 거부).
- **타임아웃 정책**: REST 요청 5초 타임아웃. WS는 30초 주기 ping/pong 하트비트, 60초 무응답 시 자원 누수 없이 연결 정리.
- **시크릿·개인정보 격리**: 공급자 API 키, 토큰, CLI 원문, 개인 식별자를 URL·응답 본문·로그·오류 메시지에 일체 노출 금지.

## 5. 정합성 및 검증 기준

- `architecture-contract.md` 준수: 웹은 읽기 전용이며 수집기 트리거 금지. DTO를 통해 도메인 불변성 유지.
- `failure-policy.md` 준수: `authentication` 발생 시 공급자 격리 및 `needs-login` 상태 전이, 자동 재시도 금지.
- 검증: 가짜 Hono 컨텍스트를 활용한 Zod 스키마 단위 테스트 및 비허가 Origin/인증 실패 차단 경계 테스트로 검증.
