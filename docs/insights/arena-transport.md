# 0.5.0 A0 Arena 전송 경로 설계

> 버전 표기는 2026-10-11 재번호로 `0.5.0`(milestone #7)로 갱신했다. ([#70](https://github.com/qus0in/yoroi/issues/70)) Arena는 2026-10-13 사용자 결정으로 제외, 코드 삭제(본 문서는 역사 기록).

상태: **확정(사용자 일괄 확정 2026-10-11)·A1 구현됨**. §8의 권고안이 그대로 승인되어 `[권고]`는 확정 사항이다. 구현은 `src/insights/arena-transport.ts`다. 근거: [실행 계약](execution-contract.md), [소스 B](sources-b.md), 기존 `src/insights/arena-parser.ts`·`sources.ts`.

## 1. 확인한 사실 (2026-10-11)

- 공개 문서: [/rows](https://huggingface.co/docs/dataset-viewer/rows)·[/parquet](https://huggingface.co/docs/dataset-viewer/parquet)·[quickstart](https://huggingface.co/docs/dataset-viewer/quick_start).
  base `https://datasets-server.huggingface.co`, 공개 데이터셋은 토큰 불필요, `/rows`는 쪽당 최대 100행.
- 익명 GET 5회만 실행(`/splits`·`/size`·`/rows` 2회·`/filter` 1회). 키·토큰 미사용, 모델명 등 원문은 기록하지 않았다.
- `lmarena-ai/leaderboard-dataset`: subset(config) 22개 × split `latest`·`full`. 전체 2,480,250행, parquet 합계 약 123.5MB.
- **`latest`는 작다**: 22개 합계 30,073행·약 1.7MB. text 10,974행(약 608KB), vision 1,124, webdev 610, agent 52, search 34.
  `full`은 text만 1,179,496행(약 59MB)이라 쓰지 않는다.
- `text/latest` `/rows`: 100행 응답 약 35KB, `partial:false`, `num_rows_total` 제공. 컬럼 11개가 파서의 표준 컬럼 집합과 일치한다.
  `vote_count`·`rank`는 float64 타입이나 값은 정수다(JSON 숫자, 파서의 정수 검사 통과).
- 첫 100행은 전부 `category=overall`, `rank` 오름차순, `leaderboard_publish_date`는 단일값(2026-10-08)이다. 이 100행 밖의 정렬은 **미확인**이다.
- `/filter`(category 조건) 1회 시도는 HTTP 500 `Unexpected error`였다. 원인 미확인이므로 의존하지 않는다.

## 2. 후보 비교

| 항목 | (a) `/rows` JSON | (b) parquet 파일 | (c) `/filter` |
| --- | --- | --- | --- |
| 의존성 | **없음**. 기존 `HttpClient`·`fetchJson` 재사용 | parquet 디코더+압축 코덱, 바이너리 본문 리더 신규(`http-body.ts`는 1MiB 문자열 한도) | 없음 |
| 요청 수 | overall 쪽 수(아래 추정 3~6) | 목록 1 + subset당 파일 1 | 이론상 최소 |
| 전송량 | text 100행당 약 35KB | text latest 약 608KB | 작음 |
| 위험 | overall 이후 카테고리까지는 쪽 수가 커짐 | 의존성 평가·승인, 신규 코드량 | 500 관측, 문서상 서버 필터 안정성 미검증 |

- **[권고] (a)로 A1을 진행한다.** `latest`가 작고 overall만 쓰면 의존성 없이 상한 안에 들어간다.
- (b)는 overall 외 다수 카테고리·많은 subset이 필요해질 때의 후속 경로다. 디코더 라이브러리 선정과 코덱 지원은 이번에 조사하지 않았다.
- (c)는 보류한다. 재시도와 안정성 확인은 A1 이후 승인된 실조회에서만 한다.

## 3. latest subset 선택 규칙 ([권고])

- split은 항상 `latest`. `full`은 금지한다(행 수·시간 상한을 깨뜨림).
- config는 코드 상수 허용목록으로 고정한다. `/splits` 동적 탐색은 하지 않는다(요청 절약, 예상 밖 subset 차단). 허용 config가 없으면 `schema-change` 계열 실패다.
- category는 `overall`만 수집한다. `offset=0`부터 100행씩 직렬로 읽다가 `overall`이 아닌 행을 만나면 그 행부터 버리고 종료한다(early stop).
- 일관성 검사: `num_rows_total`이 쪽 사이에 바뀌거나, 수집한 행의 `leaderboard_publish_date`가 하나가 아니면 그 소스는 부분 실패로 둔다. 섞인 날짜를 성공으로 저장하지 않는다.
- `/rows`에는 revision 고정 파라미터가 없다(문서 기준). 따라서 캐시 키의 요청 범위에 `dataset·config·split·category·schemaVersion`을 넣고, 데이터 일관성은 위 검사로 대신한다.
- 기준일은 행의 `leaderboard_publish_date`를 `sourceAsOf`로 그대로 쓴다(파서 동작 유지, 수집일로 대체하지 않음).

## 4. 크기·시간·페이지 상한 ([권고] 제안값)

| 항목 | 제안 | 근거 |
| --- | --- | --- |
| 쪽 크기 | 100행(서버 최대) | `/rows` 문서 |
| 쪽당 본문 | 256KiB 이하(전역 1MiB 한도는 유지) | text 100행 약 35KB의 7배 여유 |
| 소스당 HTTP 요청 | 최대 8회/실행(쪽+재시도 합계) | 실행 계약 4-A의 소스당 10회 이내. overall 쪽 수 3~6은 **추정**이며 A1 실측으로 확정 |
| 수집 행 상한 | subset당 600행. 초과하면 순위가 잘린 것이므로 실패 처리 | 잘린 순위를 성공으로 쓰지 않음 |
| 시간 | 요청 timeout 20초(`entry.timeoutMs`), 소스 전체 60초 예산 | 계약의 60초 실행 예산. 남은 `Retry-After`가 예산을 넘으면 중지 |
| 동시성 | 쪽은 직렬, `AbortSignal` 전파 | 공개 서버 부하·취소 보장 |
| 재시도 | 429/5xx 최대 1회, `Retry-After` 준수 | 계약 H1 정책. datasets-server의 공개 rate limit 수치는 문서에서 **미확인** |

## 5. 의존성

- **[권고] 경로 (a)는 신규 의존성 0개**다. `package.json` 변경이 없다.
- (b)를 택하면 parquet 디코더(순수 JS 후보)와 압축 코덱, 바이너리 크기 제한 리더가 필요하다. 라이브러리 이름·라이선스·코덱 지원은 **조사 전**이며 도입 전에 별도 승인이 필요하다.

## 6. 기존 코드와의 연결점

- `src/insights/arena-parser.ts`: `parseArenaRows(rows, observedAt)`에 `/rows` 응답의 `rows[i].row`를 그대로 넘긴다(컬럼명 동일, 변환 없음).
  `agent*` config를 추가하면 `score` 컬럼 행을 파서가 이미 처리한다(`isAgentRow`). 알 수 없는 컬럼은 파서가 경고만 남긴다.
- `src/insights/sources.ts`: `pipeline: 'hf-parquet-deferred'`를 `'hf-rows'`로 바꾸고, 현재 `unavailable`을 던지는 Arena fetch 분기(`:63`)와
  기본값 `parse` 오류인 switch(`'arena'` 케이스 없음)를 연결한다. 소스 단위 실패 반환(`source-port.ts`)은 그대로 쓴다.
- A1 신규 `src/insights/arena-transport.ts`: 쪽 요청 루프·early stop·상한·일관성 검사를 맡고 `unknown[]` 행 배열을 반환한다. 쪽 요청은 `fetchJson`을 재사용하고 `http-body.ts`는 건드리지 않는다.
- 레코드의 `sourceUrl`·`attributionText`(CC-BY-4.0)는 파서 상수를 유지한다. 전송 경로는 레코드에 넣지 않고 요청 범위(캐시 키)에만 둔다. `method`(bradley-terry/ips)는 평가 방법이라 전송 경로와 섞지 않는다.
- 약관: 사이트 스크래핑은 금지이므로 HF 경로만 쓴다([소스 B](sources-b.md)). 키는 쓰지 않는다(`auth: 'none'`).

## 7. A1 테스트 계획 (실호출 없음)

- fake `HttpClient`로 2~3쪽 합성: overall→다른 category 경계가 쪽 중간·정확히 쪽 끝인 경우, 행 상한 초과, 요청 상한 초과.
- `num_rows_total` 변경·날짜 혼재·필수 컬럼 누락·`partial:true`, 429(`Retry-After` 포함)·5xx·timeout·취소, 키·URL 외 값 비노출.

## 8. 확정 사항과 구현 (A1)

| 항목 | 확정 | 구현 위치 |
| --- | --- | --- |
| 전송 경로 | datasets-server `/rows` JSON, 신규 의존성 0 | `fetchArenaRows`(`fetchJsonWithPolicy` 재사용, 수정 없음) |
| subset·split | `text` 1개, `latest` 고정 | `ARENA_LIMITS.config`·`split` |
| 카테고리 | `overall`만, 다른 카테고리를 만나면 early stop | 쪽 순회 루프 |
| 상한 | 소스당 8요청(재시도 포함)·600행·60초, 쪽당 100행·본문 256KiB(JSON 직렬화 길이로 검사)·요청 timeout 20초 | `ARENA_LIMITS`, 정책 `maxRequests: 8`·`budgetMs: 60000` |

- 실패 규칙: 600행 초과·요청/시간 상한·`partial:true`·`num_rows_total` 변경·게시일 혼재·쪽 크기 초과는 `unavailable`, 형태 오류·overall 행 없음은 `parse`, 취소는 `cancelled`다. 잘린 순위는 성공으로 돌려주지 않는다.
- 파서 연결: `readArena(client, observedAt)`가 `fetchArenaRows` 결과를 `parseArenaRows`에 그대로 넘겨 행별 결과를 돌려준다. `sources.ts`의 Arena 분기 연결은 I0 몫이다.
- 키·헤더를 쓰지 않는 익명 GET이며 오류 메시지에는 URL·값이 없다. 테스트는 가짜 `HttpClient`만 쓰고 실호출은 하지 않는다.

## 9. 미확인 (결정 대상 아님)

- `overall` 블록의 실제 행 수(쪽 수 3~6은 추정, 600행 상한을 넘으면 실패)와 100행 이후의 정렬 보장, 데이터셋 갱신 주기, datasets-server 공개 rate limit 수치, `/filter` 500의 원인.
  A1 구현 뒤 별도 승인된 실조회(V1)에서만 확인한다.

## 10. 2026-10-12 최신 override — overall 상위 50 (사용자 승인, [top50-decision.md](top50-decision.md))

- Arena coding 탐색은 결론 없이 종료됐다. §1~§9 및 상위 20 기록은 역사로 보존하며 본 절이 최신 상위 50 수집 범위를 대체한다.
- 수집: text/latest overall의 rank≤50(50위 동점 포함, 비내림차순). 첫 100행 안에서 rank>50 또는 non-overall 경계가 확인되어야 성공.
- 경계 미확인 시 2쪽 추가 조회 없이 unavailable(잘린 상위 50 반환 금지). rank 역전·무효 rank는 unavailable, overall 0행은 parse.
- 예산: policy maxRequests 2는 429/5xx 재시도 1회 포함 상한으로만 쓰며 pageRows 100 유지. §4·§8의 600행 상한·8요청 결정은 불필요(역사 보존).
- requestScope는 `hf-rows:text:latest:overall-top50` — 이전 overall 스코프 기록과 분리되어 전환일 순위 비교는 '이전 기록 없음'(의도된 리셋).
- 첫 쪽 100행 안에서 경계 미확인 시 2쪽 미조회 unavailable 규칙으로 변경되어 2쪽 경계 소모 한계는 해소됨([top50-decision.md](top50-decision.md)).
- 구현·검증: `src/insights/arena-transport.ts`, `tests/insights-arena-transport.test.ts`·`insights-arena-boundary.test.ts`·`insights-arena-safety.test.ts`.
