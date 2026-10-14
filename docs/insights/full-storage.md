# 전체 저장 회귀 계약 (full-storage)

`scratch/packets/p5-design.md`의 저장 설계를 실제 임시 SQLite로 검증하는 회귀 계약이다.
구현은 소스 패킷 A–F가, 본 문서와 `tests/insights-full-sqlite.test.ts`는 저장 경계만 담당한다.

## 저장 경계

- 새 테이블·DDL·migration 없이 `insight_daily.payload`에 top 컷 이전의 전체 정규화 결과를 넣는다.
  키는 `(source, publication_date, request_scope, schema_version)` 유지다.
- 임시 SQLite(`mkdtempSync` + `openInsightsHistory`)에서 전체 적재 → `getDaily` 재조회 roundtrip으로
  레코드 수·행 내용 보존을 확인한다(합성 120 모델 × 3 지표 = 360행, 기존 AA 선택 컷 148보다 큼).
- `insight_history`는 비교 전용으로만 유지한다. daily 적재와 history 적재 조건은 다르다.
- **Arena 제거(2026-10-13 사용자 결정)**: 소스 id·설정·검증 분기까지 코드에서 지웠다. 기존 저장본은 읽지 않으며 90일 보존으로 자연 소멸한다.

## 계약 유지

- **3-A 유지**: AA/Cognition은 원자료 기준일을 알 수 없어 `comparisonDate=null`이다.
  해당 행은 daily에는 남지만 `insight_history`에는 넣지 않는다(`insights-store.ts:56` 건너뜀).
  관측일 fallback으로 전일/7일 증감을 계산하지 않으며 `previous`/`sevenDays`는 빈 결과를 돌려준다.
  기준일이 확인된 소스(OpenRouter·OpenCode Data `metadata.date`)만 history에 적재되어 전일 조회가 된다.
- **4-A 유지**: 같은 키의 일일 성공은 재사용해 `saveDaily`가 두 번째 저장을 거부하고,
  수동 `--refresh`(`refresh: true`)만 갱신한다. `prune(publicationDate)`은 90일 보존을 지키며
  그 밖 일일 스냅샷과 history를 함께 제거한다. 실패·불완전 페이지는 성공을 덮어쓰지 않는다.
- 행 일부 거절은 유효 측정을 `complete=0` daily에 저장·재조회해 partial로 표시하고 재수집한다.
  partial은 기존 complete를 덮거나 history에 들어가지 않으며 complete 수집은 기존 partial을 복구한다.
  `getDaily`는 기본 complete만 반환하고 수집 직후 `includePartial:true`로 partial을 읽는다.

## scope 변경

- 기존 top50 캐시를 전체 수집으로 오인하지 않도록 AA/OpenRouter/Cognition/OpenCode Data의
  requestScope를 `aa-v2:free:language-models:all`처럼 `:all` 의미의 새 값으로 바꿨다.
  키가 scope를 포함하므로 예전 `top50` 캐시는 전체 키와 충돌하지 않는다.

## 과거 551개 복원 불가

- 폐기된 과거 데이터 551개는 기존 DB에 저장된 적이 없어 복원할 수 없다.
  임의로 반복 호출하거나 과거 수치를 추정하지 않는다. 다음 허가된 수집/refresh부터 채운다.

## 검증

- `node --import ./tests/harness-setup.mjs --import tsx --test tests/insights-full-sqlite.test.ts`
- 합성 fixture만 사용하며 외부 API 호출은 없다.
