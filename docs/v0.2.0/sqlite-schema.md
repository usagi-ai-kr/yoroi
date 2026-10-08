# 0.2.0 SQLite 스키마 초안 (#33, 설계 초안)

> 준비 단계: 구현·설치 금지. 근거: [#33](https://github.com/qus0in/yoroi/issues/33) 완료 기준,
> [#30](https://github.com/qus0in/yoroi/issues/30) 공통 완료 기준, `src/domain/usage.ts`.

## 1. 매핑 원칙

- `UsageSnapshot(provider, observed_at)`이 스냅샷 키이고 `UsageWindow` 한 개가 `usage_samples` 한 행이다.
- 저장 금지: API 키·토큰·Authorization 헤더·응답 원문. 해당 값은 컬럼 자체를 두지 않는다.
- 시각 컬럼은 전부 ISO 8601(밀리초·UTC) TEXT. 지표는 0 이상 REAL, 부재는 NULL(추정 금지).

## 2. collection_runs (수집 주기·재시작 경계)

| 컬럼 | 타입 | 제약 |
| --- | --- | --- |
| id | INTEGER | PK autoincrement |
| started_at | TEXT | NOT NULL, UNIQUE |
| finished_at | TEXT | NULL 허용 |
| status | TEXT | NOT NULL, CHECK: running/completed/failed/interrupted |

- 인덱스: `(started_at DESC)` 최근 주기, `(status)` 미완료 주기 마감.
- 60초 수집 주기 1회 = 1행. 기동 시 `running` 잔존 행을 `interrupted`로 마감한다.

## 3. usage_samples (창 단위 측정 행)

| 컬럼 | 타입 | 제약 |
| --- | --- | --- |
| id | INTEGER | PK autoincrement |
| run_id | INTEGER | NOT NULL, FK → collection_runs(id) |
| provider | TEXT | NOT NULL, CHECK: 5 provider(usage.ts) |
| observed_at | TEXT | NOT NULL |
| window_id | TEXT | NOT NULL, `UsageWindow.id` |
| unit | TEXT | NOT NULL |
| used / remaining / limit | REAL | NULL 허용, ≥ 0 |
| percent | REAL | NULL 허용, CHECK 0–100 |
| reset_at | TEXT | NULL 허용 |

- 유일성: `UNIQUE(provider, observed_at, window_id)` — 스냅샷 키 + 창 id.
- 인덱스: `(provider, observed_at DESC)` 이력, `(provider, window_id, observed_at DESC)` 단위·리셋 추이,
  `(provider, reset_at)` 리셋 임박, `(run_id)` 경계 정리.

## 4. provider_events (상태·오류 이력)

| 컬럼 | 타입 | 제약 |
| --- | --- | --- |
| id | INTEGER | PK autoincrement |
| run_id | INTEGER | NULL 허용, FK → collection_runs(id) |
| provider | TEXT | NOT NULL, CHECK: 5 provider |
| occurred_at | TEXT | NOT NULL |
| kind | TEXT | NOT NULL, CHECK: auth_expired/network_error/rate_limited/parse_error/reset_anomaly/unit_mismatch |
| detail | TEXT | NULL 허용. 요약 코드만, 원문·시크릿 금지 |

- 유일성: `UNIQUE(provider, occurred_at, kind)`.
- 인덱스: `(provider, occurred_at DESC)`, `(kind, occurred_at DESC)`.
- 이벤트↔kind 매핑(명칭은 각 층 관례 유지, 의미는 아래 표로 통일):
- `usage.collected`→기록 없음 · `usage.partial`→network_error/rate_limited/parse_error ·
- `auth.expired`→auth_expired · `usage.resetChanged`→reset_anomaly/unit_mismatch.

## 5. 예외 처리 규칙

- 리셋: `reset_at`은 원문 저장. 과거 이동·소실 시 `reset_anomaly` 기록, 판정은 최신 `observed_at` 행.
- 단위 불일치: `unit`은 변환 없이 행 단위 저장. 같은 `(provider, window_id)`의 unit 변화는 `unit_mismatch` 기록, 추정 변환 금지.
- 중복 수집: 유일성 위반은 INSERT OR IGNORE. 단일 프로세스 수집이 1차, 유일성은 최후 방어(#30).
- 재시작 경계: `interrupted` 주기 샘플은 보존하되 마지막 정상 기록으로만 쓰고, 기본 집계는 `completed` 주기만 포함.

## 6. 연결·마이그레이션·임시 DB

- 커넥션 생성 시 `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON`.
- Drizzle Kit: 스키마 정의에서 `generate`로 마이그레이션 SQL 산출물을 커밋하고 `migrate`로 적용.
  파일은 커밋 후 불변, 저널 테이블 기록으로 중복 적용을 막아 재실행 가능.
- 임시 DB: 테스트마다 OS 임시 디렉터리에 파일 DB 생성 후 종료 시 DB·WAL·SHM 제거(`:memory:`는 WAL 실측 불가).
- 검증: 합성 데이터로 중복·리셋·단위·재시작 시나리오 실행 + 기존 CLI 회귀를 기록(#33 검증 기준).
