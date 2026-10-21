# 웹 PostgreSQL 이관 진행 (2026-10-21, w3 · #263)

- 범위(현재 단위) ✓: **요구·스키마·전환/검증 계획 + 사용자 조치 초안** 준비만 ✓.
  의존성·package/lock·공용 코드 수정·구현 실행은 **레터 단위 완료 후** ✓.
- 우선순위 정정 ✓: **레터 먼저**, 유휴 워커로 Postgres 준비 ✓ · 실제 DB/계정 생성·업로드·배포·커밋·PR 금지 ✓.
- 사용자 조치 초안 ✓ → `tmp/yoroi-263-user-actions.md` (한 handle 이슈, qus0in 담당) ✓.
- 개인 사용량·OAuth/토큰·로컬 인증 저장소는 이관 대상 아님 ✓ (읽기 전용 확인만 ✓).

## 1. 현재 SQLite 경계 (확인됨)

- 포트 `src/insights/history-port.ts` — `InsightHistoryPort` : `getDaily` · `saveDaily` · `previous` · `sevenDays` · `prune` ✓.
- 구현체: `src/infra/sqlite/insights-store.ts`(쓰기) + `insights-store-read.ts`(읽기) · 메모리 구현 `src/insights/history-memory.ts` ✓.
- 스키마 `src/infra/sqlite/insights-migration.ts` (v5) — 두 테이블 ✓:
  - `insight_daily(source, publication_date, request_scope, schema_version, complete, record_count, payload, saved_at)` PK 4종 ✓
  - `insight_history(source, model_id, metric, unit, category, schema_version, request_scope, publication_date,
    comparison_date, observed_at, value, model_alias, source_as_of, source_url, source_name, license,
    attribution_text, method, metadata)` UNIQUE 8종 ✓ (comparison_date NULL 은 중복 억제 안 됨 — SQLite 와 동일 ✓)
- 저장 규칙 ✓: 부분 거절은 partial daily 로 보존 ✓ · 실패·빈 페이지·기존 complete 덮어쓰기 거부 ✓ ·
  재검증 후 저장 ✓ · `observed_at` 가 최신일 때만 upsert ✓ · 08:00 KST 발행 계약과 분리된 저장소 ✓.

## 2. PostgreSQL 목표 스키마(설계안 · 미적용)

- 표준 PG 경로 ✓ — `postgresql://` 연결 문자열 + 표준 SQL ✓ (공급자 특정 API 없음 ✓).
- `insight_daily`: `payload JSONB` · `complete BOOLEAN` · `saved_at TIMESTAMPTZ` · 나머지 `TEXT` ✓ · PK 4종 ✓.
- `insight_history`: `value DOUBLE PRECISION` · `comparison_date DATE` · `metadata JSONB` · `observed_at TIMESTAMPTZ` ✓ · UNIQUE 8종 ✓.
- 인덱스 ✓: `insight_daily(publication_date)` · `insight_history(publication_date)` · `insight_history(시리즈 8종)` ✓.
- 마이그레이션 ✓: 버전 관리(적용 순서 기록 ✓) + `CREATE TABLE IF NOT EXISTS` + advisory lock으로 단일 적용 ✓ (구현은 후속 단위 ✓).
- 매핑 규칙 ✓: `complete` 0/1 → BOOLEAN ✓ · `payload` TEXT → JSONB ✓ · `metadata` TEXT → JSONB ✓ ·
  `comparison_date` NULL 유지 ✓ (중복 억제 의미 동일 ✓).

## 3. 구현 순서(레터 완료 후)

1. **포트·클라이언트 경계** ✓ — `src/infra/postgres/` : 최소 `query`/`transaction` 클라이언트 포트 ✓ (드라이버 주입 ✓).
2. **스키마·마이그레이션** ✓ — 위 DDL + 버전 관리 ✓.
3. **저장소 구현** ✓ — `InsightHistoryPort` 그대로 구현(SQLite 와 같은 저장 규칙 ✓).
4. **가짜 클라이언트 계약 테스트** ✓ — 트랜잭션 롤백 ✓ · 멱등(중복 저장) ✓ · partial snapshot ✓ · 실패≠성공 위장 금지 ✓.
5. **읽기 스냅샷 경로** ✓ — 발행 시점 스냅샷을 PG 에서 읽는 읽기 전용 경로 ✓ (별도 단위 ✓).
6. **전환** ✓ — 읽기 shadow 비교 → 컷오버 → SQLite 보존(90일) ✓ (승인 후 ✓).

## 4. 검증 계획

- 로컬(실DB 없음) ✓: 가짜 SQL 클라이언트로 계약 테스트 ✓ (위 4번 ✓) + 기존 SQLite 테스트 유지로 회귀 0 확인 ✓.
- 실DB(사용자 제공 후) ✓: 연결·마이그레이션 적용·저장/조회·멱등·부분 snapshot·prune 스모크 ✓ (기록 남김 ✓).
- 발행 계약 ✓: 08:00 KST 게이트·발행 멱등성·댓글 3개 계약·부분 수집 표기 불변 ✓ (회귀 테스트로 고정 ✓).
- 원격 실패 시 memory 성공으로 위장 금지 ✓ (경계에서 명시적 실패 ✓).

## 5. 이미 생긴 WIP(보존 · 소유 이전)

- `#266 두 번째 조합 정책 복원(오픈 웨이트·Free union)` 의 소스 변경이 워킹 트리에 남아 있다 ✓ (커밋 전 ✓).
  → **레터 파일 소유를 w1(p2)로 이전** ✓ · w3 는 레터 코드 수정 금지 ✓ (이 단위에서 소스 변경 0건 ✓).
- 레터 WIP 8파일과 그 테스트는 읽기 전용 ✓ (요구 문서 ✓).

## 6. 다음 단위(레터 완료 후 실행)

- 패킷 초안 ✓: `yoroi-263-postgres-client-port` — 소유 `src/infra/postgres/types.ts` · `src/infra/postgres/insights-migration.ts` ·
  `tests/postgres-insights.test.ts` · `docs/insights/postgres-migration-progress-20261021.md` 갱신 ✓.
  완료 기준: DDL 버전 관리 + 가짜 클라이언트 계약 테스트(트랜잭션/멱등/partial) 통과 ✓ · 의존성 추가 금지(후속 별도 승인 ✓) ✓.
- 후속 패킷 예고 ✓: `yoroi-263-postgres-store` (저장소 구현) · `yoroi-263-pg-read-snapshot` (읽기 스냅샷) · `yoroi-263-cutover` (승인 후 컷오버) ✓.
