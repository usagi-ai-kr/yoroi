# Issue #190 Unit C: Arena 코딩 소스 등록·전송 포트 (2026-10-20)

- 범위: HF rows 전송 계층(단위B)과 순수 파서(단위A)를 **1급 insight source**로 등록하고 소스 포트에 연결.
  **단위C이며 #190 전체 완료를 뜻하지 않는다**(수집 통합·레터 연결은 후속).
- 소유: `src/insights/{record,run-once-steps,sources}.ts`·`src/insights/sources-arena-coding-port.ts`·
  `tests/insights-arena-coding-port.test.ts`·본 문서.

## 1. 소스 등록

- `InsightSource` 유니온에 `'arena-coding'` 추가(`record.ts`). 기존 `overall arena` 계통과 **분리된 신규 id**다.
- `INSIGHT_SOURCES` 항목: displayName `Arena Coding (HF Leaderboard)` · url `https://datasets-server.huggingface.co/rows` ·
  license `CC-BY-4.0` · attribution `Source: Arena Leaderboard Dataset (https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset). CC BY 4.0.` ·
  timeout 15s · auth `none`(시크릿 불필요) · pipeline **`arena-rows`**.
- `run-once-steps.ts`의 필수 맵 3종에 신규 id를 채웠다(기존 항목 값은 그대로):
  - `DEFAULT_SCHEMA_VERSIONS['arena-coding'] = 'arena-coding-v1'`
  - `DEFAULT_REQUEST_SCOPES['arena-coding'] = 'arena-coding:hf-rows:webdev.agent_bash_recovery_steps:latest'`
    (요청 범위는 이력 키 안전 문자 `A-Za-z0-9._:@-`만 허용 — `+` 등 다른 문자는 `dailyId`가 거부한다)
  - `RANK_COHORTS['arena-coding'] = { metric: 'arena_coding_rating', order: 'descending' }`
    (webdev Code Arena 레이팅만 순위 코호트로 쓴다. agent IPS는 다른 리딩보드라 같은 카테고리에서 섞지 않는다)

## 2. 포트 구현(`sources-arena-coding-port.ts`)

- `fetchArenaCodingPayload`가 `webdev`·`agent_bash_recovery_steps`(latest)를 `fetchArenaCodingSubset`로 수집한다.
  **한 서브셋 실패가 다른 서브셋을 중단시키지 않는다**(실패는 해당 서브셋의 error로만 남고 다른 행은 보존).
- `parseArenaCodingPayload`가 `ParseRowResult`로 매핑한다. 레코드 필드: source `arena-coding` · metric
  `arena_coding_rating`/`arena_coding_score` · value(원문) · unit `score` · category · observedAt ·
  **sourceAsOf = 게시일**(있을 때) · sourceUrl · sourceName · license `CC-BY-4.0` · attributionText ·
  method `official-dataset` · schemaVersion `arena-coding-v1` · metadata{date, subset, effort, effortQualifier?, rank?}.
- **게시일이 없는 행은 버린다.** sourceAsOf는 데이터 기준일이어야 하며 관측시각 fallback은 검증 단계에서 거부된다
  (`validation.ts`의 `sourceAsOfBasis` 규칙). 임의 대체 금지.
- 기존 `overall arena`·다른 소스 행을 이 소스로 승격하지 않는다(검증 단계의 source 일치 규칙이 보장).

## 3. 테스트(합성 픽스처, 실네트워크 0)

`tests/insights-arena-coding-port.test.ts` 5건: 소스 등록·메타데이터·요구맵 / URL·파라미터(dataset·config·split·offset·length) /
두 서브셋 수집·매핑 / 한 서브셋 실패 격리(다른 서브셋 1행 생존·실패는 거부 행 집계) / 교차 소스 혼합 없음.
`createInsightSourcePorts`가 `arenaFetcher` 주입을 받아 테스트에서 네트워크를 쓰지 않는다.

## 4. 유니온 확장의 필수 동반 갱신(소유 밖 3파일, 최소·동작 불변)

`InsightSource` 유니온에 값을 추가하면 닫힌 매핑이 깨져 컴파일이 막힌다. 판정 표에서 필요한 최소 갱신만 했다.
- `src/insights/types.ts` `isInsightSource` — 닫힌 소스 목록에 `'arena-coding'` 1항 추가(없으면 모든 레코드가 unknown-source로 거부된다).
- `tests/insights-four-source-wiring.test.ts` — 지표 맵 타입을 `Record<string, readonly string[]>`로 완화(내용·포함 소스 불변).
- `tests/insights-run-once.test.ts` — payload/parser 맵 타입을 문자 키로 완화 + 인덱스 non-null 단언(동작 불변).

## 4-1. 발견·수정한 계약 위반 1건

- 요청 범위 문자열에 `+`를 쓰면 `history-memory.dailyId`의 안전 문자 검사(`^[A-Za-z0-9._:@-]{1,128}$`)를 통과하지 못해
  저장 시 RangeError → 소스가 `parse/internal-error`로 실패한다(수집은 되지만 저장되지 않음).
  범위 문자열을 `.` 구분으로 바꿔 해결했다(위 §1).

## 5. 남은 범위(#190 미완료)

1. 실제 수집 연결(once 파이프라인에서 이 소스 호출) — 미구현.
2. 저장 계통 분리(arena-coding은 기존 overall arena 계통과 다른 source id로 저장·비교선 분리) — 미구현.
3. 레터 반영(후보·근거 행·Top N 구성) — 미구현.
4. HF 스키마 변동 대응(행 스키마는 2026-10-20 실측 기준) — 감시 필요.
