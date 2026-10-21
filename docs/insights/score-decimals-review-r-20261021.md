# 점수 소수점 두 자리 독립 리뷰 r (2026-10-21, #249)

- 이슈: [#249](https://github.com/usagi-ai-kr/yoroi/issues/249). 패킷 `yoroi-249-score-decimals-review-r`. 요구사항: [score-decimals-dispatch-20261021.md](score-decimals-dispatch-20261021.md).
- 대상: w1의 미커밋 변경. 소스 2줄(`src/insights/letter-top10-unified.ts:46` `toFixed(2)`, `src/insights/letter-three-role-render.ts:45` `scoreCell` `toFixed(2)`), 테스트 8개 파일(16줄). 기준 HEAD `6210164`.
- 방법: `git diff` 대조, 검증 명령 재실행(백그라운드), 원 점수 동일·표시만 다른 입력으로 Free 함수 출력 비교(`tmp/yoroi-249-r-probe.ts`). 격리 스냅샷은 생략했다(요청 반영).

## 판정

**BLOCK**. Free 표의 👍 파레토 판정과 행 정렬이 원 점수가 아니라 표시 문자열 정밀도에 따라 바뀐다. 디스패치 계약("표시 문자열만 통일")과 패킷 기준("파레토·순위 불변")을 어긴다.

## 항목별 근거

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 역할 표 2자리(2역할 본문·댓글) | PASS | `letter-markdown-tables.ts:17` `e.scoreText` ← `letter-top10-unified.ts:46`. 테스트 `insights-top10-unified.test.ts:40` `/^\d+\.\d\d$/` |
| 3역할 표 2자리 | PASS | `letter-three-role-render.ts:45` `toFixed(2)`. `insights-letter-three-role-render.test.ts`의 `57.60`·`70.00`·`100.00` |
| Free 칸 2자리 | PASS | `letter-markdown-free-sort.ts:43` `score: entry.scoreText`. 리뷰어 칸은 기존 `insights-free-reviewer.ts:45` `toFixed(2)` |
| 요약 선두 2자리 | PASS | `letter-top10-legend.ts:41` `leadText`가 `scoreText`를 씀 |
| `-`/`✗`/미확인 미채움 | PASS | `unified.ts:46` 비유한 값 → `'-'`. `render.ts:45` 비숫자 → `'-'`. `letter-markdown-free-table.ts:32` `✗` 불변 |
| 원시 점수·순위·가중치·후보 수 | PASS | diff에 계산·가중치·후보 선별 변경 없음. `rawScore: s.score` 유지. `letter-reviewer-policy.ts` 미변경 |
| 2역할 파레토(그룹 판정) | PASS | `isPareto`는 그룹 원 계산(`letter-top10-unified.ts:47`)에서 오며 표시 문자열과 무관 |
| 3역할 선별 순서 | PASS(조건부) | `letter-three-role.ts:63` 정렬 키가 `insights-three-role.ts:30`의 `Number(scoreText)`. 점수가 순위에 따라 단조 감소하면 순서 불변(calibration 단조성 테스트 근거) |
| **Free 👍 파레토 판정** | **FAIL** | `letter-markdown-free-sort.ts:40·47` `starsOf` → `scoreOf`(`:22`)가 `Number(scoreText)` 사용, 엄격 `>` 비교 |
| **Free 행 정렬** | **FAIL** | `freeRowOrder`의 `bestScore`가 `FreeCell.score`(2자리 문자열)를 숫자로 읽음 |
| BDD·단위 테스트 갱신 | PARTIAL | 단위 테스트 8개 파일 갱신. `features/insights.feature` 미변경이고 스코어 문구 단언이 없어, BDD 45/45는 이 변경을 검증하지 못함 |

## 프로브(원 점수 동일, 표시 정밀도만 다름)

- 입력: `m-a` 원 점수 80.46, `m-b` 원 점수 80.54.
- 옛 1자리 표시(`80.5`, `80.5`): `m-a:pareto=true | m-b:pareto=true`, 이름순.
- 새 2자리 표시(`80.46`, `80.54`): `m-b:pareto=true | m-a:pareto=false`, `m-b`가 먼저.
- 결론: 👍과 행 순서가 원 점수가 아니라 표시 문자열에 따라 바뀐다. 1자리 동점 쌍이 있으면 발생한다. 실데이터의 동점 빈도는 측정하지 않았다.

## 검증 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-249-r-check.log` `TYPECHECK_EXIT=0` |
| node:test | PASS 1434/1434 | 같은 로그: `ℹ tests 1434` / `pass 1434` / `fail 0` |
| BDD | PASS 45/45 | 같은 로그: `45 scenarios (45 passed)`, `635 steps` |
| build | PASS | `BUILD_EXIT=0` (tmp outDir, dist 미사용) |
| validate-repo | PASS | exit 0, 1026 files (`tmp/yoroi-249-r-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `letter-top10-unified.ts` 100줄, `letter-three-role-render.ts` 93줄 |

## 비차단 후속

- **가산 열**: 2역할 워커 가산(`+N.N`, `letter-top10-legend.ts:39`)은 1자리 그대로다. 스코어 구성요소이므로 2자리 통일 여부를 정해야 한다.
- **테스트 공백**: `tests/insights-markdown.test.ts:14·58-61`은 `scoreText` 픽스처를 그대로 통과시키며 1자리 literal을 단언한다. 라이브 2자리 경로를 검증하지 않는다.
- **문서 불일치**: `score-decimals-20261021.md`의 "0패딩 금지"는 구현(`50.00`, 계약 예시 `81.50`)과 맞지 않는다. "파레토 불변"도 Free 👍 경로에서는 사실이 아니다.
- **범위 유지**: AA 지수(`indexText`)와 변형 문자열(`variants`)은 스코어가 아니므로 1자리를 유지한다.

## 수정 방향(w1 담당, 리뷰어는 수정하지 않음)

Free 👍 판정(`starsOf`)과 Free 정렬(`scoreOf`·`bestScore`)을 표시 문자열이 아니라 이전 정밀도 값이나 원 점수 숫자로 계산한다. 그리고 1자리 동점 회귀 테스트를 위 프로브 입력으로 추가한다.

## 재발행 위험

- 본문·댓글·Free 칸·요약 선두의 점수 자리수만 바뀐다. 값과 순위는 같다.
- **BLOCK 조건**: 위 수정 전에는 발행하지 않는다. 발행 본문에서 Free 👍이 사라지고 행 순서가 바뀐다. 실데이터의 동점 여부는 발행 전에 측정해야 한다.

## 준수

코드·테스트·계산·순위를 바꾸지 않았다. 외부 쓰기, 레터 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그와 프로브뿐이다.
