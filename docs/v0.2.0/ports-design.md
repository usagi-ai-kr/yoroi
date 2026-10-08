# 저장·수집·조회 포트 설계 (#34·#37·#38, 설계 초안)

> 준비 단계: 시그니처 스케치만, 구현 금지. 근거: #31(포트·단일 수집), schema·cache 문서.

## 1. 저장 포트 (#34, 영구 이력 쓰기 전담)

```ts
interface RunHandle { readonly runId: number; }
interface SampleStore {
  beginRun(startedAt: string): Promise<RunHandle>;
  saveSamples(run: RunHandle, results: readonly UsageResult[]): Promise<void>;
  recordEvent(run: RunHandle | null, event: ProviderEvent): Promise<void>;
  finishRun(run: RunHandle, status: "completed" | "failed"): Promise<void>;
  markInterrupted(): Promise<void>; // 기동 시 running 잔존 마감
}
```

- 유일성 위반은 INSERT OR IGNORE. 비밀값·원문 컬럼 없음(schema §1).
- 호출 주체: 수집기만. REST·WS·웹은 쓰기 호출 금지.

## 2. 수집 스케줄 포트 (#37, 주기·저장 연결)

```ts
interface Collector {
  collectOnce(signal: AbortSignal): Promise<readonly UsageResult[]>;
}
interface CollectorLoop {
  start(signal: AbortSignal): Promise<void>; // 1회 수집→저장→60초 대기 반복
}
```

- 순서: `beginRun` → `collectOnce` → `saveSamples`/`recordEvent` → `finishRun`.
- 실패해도 루프 유지(failure-policy §3 격리). 중복 실행 금지(단일 프로세스).

## 3. 조회·집계 포트 (#38, 읽기 전담)

```ts
interface HistoryQuery { provider?: ProviderId; from?: string; to?: string; limit?: number; }
interface UsageReadModel {
  latest(): Promise<readonly ProviderSummary[]>; // LRU→TTL→DB
  history(query: HistoryQuery): Promise<readonly HistoryRow[]>;
  providers(): Promise<readonly ProviderState[]>; // 상태·신선도
}
```

- 집계 키: `v1:agg:{provider}:{24h|7d|30d}`, 히스토리 키는 cache §3 인코딩.
- `completed` 주기만 집계, `stale`은 표시만(baseline §4·failure §1).
- 무효화: 저장·리셋·오류 전이 시 관련 키만(신호는 WS가 발행).

## 4. 검증 계획

- 가짜 저장소로 중복·리셋·단위·재시작·중단 시나리오 + CLI 회귀.
- 결과는 #34·#37·#38에 기록. 포트 위반 방향(ui→infra 직접 등)은 실패 처리.
