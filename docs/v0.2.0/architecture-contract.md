# 0.2.0 아키텍처·이벤트 계약 (#31, 설계 초안)

> 준비 단계: 구현 코드 금지. 상위 계획 #30, CLI #28은 별도 검토·머지.

## 1. 의존 방향 (0.1.0 구조 유지)

- `domain/usage.ts`: `providers`, `UsageSnapshot` 불변 검증. 누구도 domain을 우회하지 않음.
- `app/usage-source.ts`: `UsageSource.read()`·`UsageResult` 포트가 유일 수집 추상화.
- `app/collect-once.ts`·`watch-usage.ts`: 1회 수집·수집완료-후-대기 반복만 담당.
- `infra/*-source.ts`·`composition/sources.ts`: 포트 구현·팩토리. app은 infra를 모름.
- `ui/cli/*`: `collectOnce`·`watchUsage` 호출만. 파싱·HTTP·프로세스 직접 호출 금지.
- `composition-root.ts`: `loadConfig→createSources→createCli` 배선 전담. 시작 순서 근거.

## 2. 단일 수집 주체 (CLI·웹 중복 금지)

- 단일 프로세스(PM2 fork 1)의 `CollectorService`만 `collectOnce()` 호출.
- 주기: 수집 완료 후 60초 대기(기존 `watchUsage` non-overlapping 의미, #30 공통 기준).
- CLI `once`/`watch`는 수동·디버그용으로 `CollectorService`와 동시 실행하지 않음.
- 웹은 수집 호출 금지: REST 조회·WS 구독·캐시 읽기만. 저장 쓰기는 수집기만.

## 3. 서비스 생명주기 순서

- 시작: config 확정 → 저장 포트 연결(SQLite/Drizzle·TTL·LRU) → 수집기 1회 수집 →
- REST/WS 리슨 → 웹 정적 서빙 → 스케줄러 가동. 실패 시 리슨 전 종료코드 2.
- 종료: SIGTERM → 스케줄러 중단 → 진행 중 수집 완료 대기 → WS 종료 알림 →
- 저장 플러시·연결 닫기 → 로그 회전 확인. 역순 정리, 중복 정리는 1회만.

## 4. 공통 이벤트·DTO (Zod 스케치, 구현 아님)

- `usage.collected`: 수집 성공. 전 공급자 스냅샷 확정 시 1회.
- `usage.partial`: 부분 실패. 성공분 저장 + 공급자별 `SourceErrorCode` 첨부.
- `auth.expired`: `authentication` 코드 격리. 공급자별 실패로만 기록(#30).
- `usage.resetChanged`: `resetAt` 변경 감지 시. rolling window 모호하면 추정치 미발행.

```ts
const eventName = z.enum(["usage.collected", "usage.partial"]);
const providerEvent = z.object({ provider: z.enum(providers), at: z.string(),
  errorCode: z.enum(["authentication", "network", "timeout"]).optional(),
  resetAt: z.string().optional() });
```

- DTO 원칙: `UsageSnapshot` 그대로 노출 금지, 집계 DTO만. 시크릿·원문 미포함.
- WS는 변경 알림만 보내고 본문 재조회는 REST로. 인증·origin·타임아웃은 #43 범위.

## 5. CLI 보존 경계 테스트·아키텍처 검증 계획

- `once` 출력·종료코드 회귀: 합성 팩토리로 전성공/전실패/혼합 3종 고정.
- `watch` non-overlap: 수집 중 타이머 미발화, 완료 후 대기 1회만 확인.
- 격리: `authentication` 1곳 실패가 타 공급자 스냅샷을 오염시키지 않음.
- 리셋: `resetAt` 변경만 `resetChanged`, 모호 window는 선형 기준선 미표시.
- 방향 검사: `ui/*`의 infra 직접 import, 웹 측 수집 호출 존재 시 실패 처리.
- 기록: 합성 데이터 결과와 CLI 회귀 결과를 본 문서 검증란에 날짜와 함께 남김.
