# Free 풀 민감도 회귀 재검토 r (2026-10-21, #261)

- 이슈: [#261](https://github.com/usagi-ai-kr/yoroi/issues/261), [#260](https://github.com/usagi-ai-kr/yoroi/issues/260). 패킷 `yoroi-261-sensitivity-review-r`. 요구사항: [free-combo-matching-dispatch-20261021.md](free-combo-matching-dispatch-20261021.md). 이전 리뷰: [free-combo-matching-regression-review-r-20261021.md](free-combo-matching-regression-review-r-20261021.md)(BLOCK, 감도 부족).
- 대상: 이번 라운드 추가분 `tests/model-display.test.ts:89-100`(민감도 회귀 1건). 이번 라운드에 바뀐 파일은 이 테스트 파일뿐이다(mtime 확인). 기존 회귀 2건(`:66`, `:78`)은 단언이 그대로다(줄 바꿈·주석만 정리됨). 프로덕션 파일 7개는 바뀌지 않았다. 기준 HEAD `148e777`.
- 방법: 테스트 본문과 픽스처 읽기, 테스트 단언을 그대로 옮긴 프로브(`tmp/yoroi-261-r6-probe.ts`, 리뷰 후 삭제)를 정상 풀과 결함 풀(미측정 항목의 identityKey 제거)에 각각 적용, 검증 재실행. 레포 파일은 건드리지 않았다. 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**PASS**. 이전 BLOCK의 원인(회귀가 결함을 잡지 못함)이 해소됐다. 새 테스트는 정상 코드에서 통과하고, identityKey 누락 결함에서 정확히 실패한다. 프로덕션 코드·점수·순위·Free 표·댓글·publish는 이번 라운드에 바뀌지 않았다.

## 민감도 확인

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 픽스처 | PASS | `ids=[deepseek-v4-1-flash-free, mimo-v2-6-flash-free]`, `o=[deepseek 62.9]`, `r=[mimo 0.7]`, `w=[mimo 58]`. `tests/model-display.test.ts:91-92` |
| 정상 경로 | PASS | 프로브: `free-1+2 feasible=false`, `slots=0`, 사유 있음. 테스트 통과(`:97-99`) |
| 결함 시 실패 | PASS | 프로브: 미측정 항목의 identityKey 제거 → 딥시크 중복 구성으로 `feasible=true` → 단언 실패 "후보 부족 → 구성 불가(identityKey 누락 시 실패)" |
| 감도가 생기는 이유 | PASS | 워커 후보가 mimo와 딥시크-free 둘뿐이라 정렬 순서와 무관하게 결함이 드러난다. 정상 경로에서는 같은 실체가 제외되어 후보가 1개뿐이다 |

## 경로와 날조

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 실제 경로 | PASS | `freePolicyPool(ids, lists)` → `buildTeamCombinations({freePool})`. `tests/model-display.test.ts:93`, `:96` |
| 점수 날조 없음 | PASS | 미측정 Free 항목에는 score가 없다. 테스트 점수는 입력 객체의 값이다 |
| 픽스처 척도 | 메모 | 리뷰어 점수 0.7은 프로덕션 0~100과 척도가 다르다(단언에는 영향 없음) |

## 프로덕션·불변

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 프로덕션 코드 미변경 | PASS | `find src config -newer tmp/yoroi-261-r5-check.log` 결과 없음. 변경 파일 집합 7개, `67 insertions / 24 deletions`로 이전과 동일 |
| 점수·순위·Free 표·댓글·publish | PASS | `letter-markdown.ts`, `letter-markdown-tables.ts`, `letter-markdown-free-sort.ts`, `letter-three-role.ts`, `letter-role-selection.ts`, `insights-publish.ts`, `insights-cli.ts`, `letter-three-role-body.ts`, 정책 파일 diff 빈 결과 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-261-r6-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1463/1463 | 같은 로그 `ℹ tests 1463` / `pass 1463` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1056 files(`tmp/yoroi-261-r6-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `tests/model-display.test.ts` 100(한계 도달), `tests/insights-team-combinations.test.ts` 99, `tests/insights-letter-three-role-pipeline.test.ts` 100 |

## 비차단 메모

- N1 기존 중복 테스트: `tests/model-display.test.ts:66`은 여전히 이 결함에 둔감하다. 새 민감도 테스트가 그 역할을 맡는다.
- N2 픽스처 척도: 리뷰어 점수 0.7·0.68·0.74는 프로덕션 0~100과 다르다. 단언에는 영향이 없다.
- N3 파일 한계: `tests/model-display.test.ts`가 정확히 100줄이다. 다음 추가에서는 분리가 필요하다.
- N4 실데이터와 GitHub 렌더는 여전히 확인하지 않았다.

## 커밋·발행 게이트

- 회귀 보호 조건(C1)은 충족됐다. 커밋 범위에서 `pnpm run check`를 다시 돌린 뒤 커밋·발행을 판단한다.
- 커밋 범위에는 신규 파일(`src/insights/model-display.ts`, `config/model-display-rules.json`, `tests/model-display.test.ts`, `src/insights/letter-team-runners.ts`)을 포함한다.

## 준수

코드·테스트·점수·순위·Free 표·댓글·publish를 바꾸지 않았다. 레포 파일은 건드리지 않았다. 결함은 프로브 스크립트 안에서 풀 객체만 바꿔 흉내 냈다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
