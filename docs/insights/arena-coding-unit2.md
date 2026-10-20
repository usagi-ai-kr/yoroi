# Issue #190 Unit B: Arena(HF) 코딩 서브셋 전송·페이지네이션

## 1. 개요
Issue #190 (Arena HF 코딩 서브셋 수집)의 **Unit B: 전송 및 페이지네이션 계층** 구현 명세다. 순수 파서(`arena-coding-parser.ts`)를 재사용하며, DB·카탈로그·레터·once 파이프라인과의 통합은 후속 단위에서 수행한다.

## 2. 확인된 공용 API 규격 (2026-10-20 실측)
- **엔드포인트**: `https://datasets-server.huggingface.co/rows`
- **조회 대상**:
  - `dataset=lmarena-ai/leaderboard-dataset&config=webdev&split=latest&offset=0&length=100`
  - `dataset=lmarena-ai/leaderboard-dataset&config=agent_bash_recovery_steps&split=latest&offset=0&length=100`
- **응답 스키마 (직접 확인)**:
  `{ rows: [{ row_idx: number, row: Record<string, unknown> }], num_rows_total: number, num_rows_per_page: number, partial: boolean }`
- **실측 규모 (2026-10-20)**:
  - `webdev` (latest): 총 626행
  - `agent_bash_recovery_steps` (latest): 총 52행 (행 스키마는 2026-10-20 실응답으로 직접 확정됨: score, score_ci_lower/upper, observation_count, session_count 실존)
- **주의**: 확인된 두 서브셋 외의 광범위한 스키마 확장을 임의 주장하지 않는다.

## 3. 전송 계층 설계 (`src/insights/sources-arena-coding.ts`)
- `buildArenaRowsUrl`: `dataset`, `config`, `split`, `offset`, `length` 쿼리 파라미터 조합.
- `fetchArenaCodingSubset`:
  - `HttpClient` 또는 주입형 `fetcher` 인터페이스 지원 (테스트 시 실네트워크 호출 차단).
  - 공개 HF 엔드포인트에 맞춰 `User-Agent: yoroi-insights/1.0` 헤더 설정 (시크릿 불필요).
  - `maxPages` 및 `maxRows` 상한 가드 적용 (기본 20페이지 / 2000행).
  - 동일 수집 내 `row_idx` 기반 중복 행 방어 (서버가 offset을 무시해도 행 중복 방지).
  - 각 행은 `parseArenaCodingRow(row, config)`로 파싱하며, 유효하지 않은 행은 버리고 동일 식별자 병합은 수행하지 않는다.
  - 1페이지 실패 시 `status: 'error'`, 후속 페이지 실패 또는 미달 시 `status: 'partial'` 및 잔여 행 보존.

## 4. 검증 결과 (`tests/insights-arena-coding-source.test.ts`)
합성 픽스처 기반 8개 단위 테스트 통과:
1. `2-page fixture pagination`: 다중 페이지 오프셋 순회 및 행 취합
2. `webdev vs agent subset metric`: webdev(rating) vs agent(score) 지표 분기
3. `malformed row skipped without error`: 형식 오류 행 배제 및 정상 행 보존
4. `HTTP failure on first page and later page`: 1페이지 에러 및 2페이지 부분 수집 처리
5. `partial/short page before total or flag`: 응답 플래그 및 단축 페이지 partial 판정
6. `cap enforcement (maxPages and maxRows)`: 페이지/행 상한 도달 시 조기 종료
7. `URL parameters correctly formatted`: 요청 URL 및 파라미터 인코딩 확인
8. `dedupe repeated rows by row_idx across pages`: 중복 row_idx 행 필터링 검증

> [!NOTE]
> 본 구현은 Issue #190의 Unit B(HF 전송·페이지네이션) 단계이며, SQLite 계통 분리 및 once 수집 통합 전까지 #190을 완료 처리하지 않는다.
