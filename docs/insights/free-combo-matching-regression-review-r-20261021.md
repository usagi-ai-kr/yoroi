# Free 풀 회귀 테스트 재리뷰 r (2026-10-21, #261)

- 이슈: [#261](https://github.com/usagi-ai-kr/yoroi/issues/261), [#260](https://github.com/usagi-ai-kr/yoroi/issues/260). 패킷 `yoroi-261-free-pool-regression-review-r`. 요구사항: [free-combo-matching-dispatch-20261021.md](free-combo-matching-dispatch-20261021.md). 이전 리뷰: [free-combo-matching-rereview-r-20261021.md](free-combo-matching-rereview-r-20261021.md)(PASS 조건부, C1).
- 대상: 이번 라운드 테스트 추가분 `tests/model-display.test.ts:61-88`(회귀 2건). 프로덕션 파일 7개는 이전 검토 이후 바뀌지 않았다(mtime 확인). 기준 HEAD `148e777`.
- 방법: 회귀 테스트 본문과 입력 읽기, 프로덕션 파일 변경 시각 확인, identityKey 누락 상태를 프로브 스크립트 안에서 풀 객체만 변형해 흉내 냄(레포 파일은 변경하지 않음), 검증 재실행. 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**BLOCK**. 프로덕션 동작은 정상이다. 그러나 C1로 요구한 회귀 2건 중 중복 방지 테스트(a)가 원래 결함을 잡지 못한다. 결함을 되살려도 테스트 세 개가 모두 통과한다. 회귀 보호가 목적이므로, 이 보강이 끝날 때까지 발행하지 않는다.

## 회귀 2건 확인

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 실제 경로 사용 | PASS | 두 테스트 모두 `freePolicyPool`과 `buildTeamCombinations`를 호출한다. `tests/model-display.test.ts:68`, `:80` |
| (a) 1+1+3·1+2에 canonical 중복 0 | 기준은 충족, **감도 부족** | 현재 입력에서는 중복이 없다. 그러나 identityKey 누락을 흉내 낸 상태에서도 `dup=false`로 통과한다. 정렬상 미측정 Beam이 먼저 뽑히기 때문이다 |
| (b) O/R 미측정 없음, Beam은 W에만 | PASS(감도 있음) | `:81-82`의 `score === undefined` 직접 단언. O/R에 미측정이 들어가면 실패한다 |
| 기존 회귀 유지 | PASS | 매칭·유료 제외 `model-display.test.ts:50-59`. 노드·캡션 🆓 `insights-mermaid.test.ts:64-65`. 차선 줄 `:52-53`. 캡션 이스케이프 `:78`. 뱃지 `insights-letter-three-role-pipeline.test.ts:99` |
| 점수 날조 없음 | PASS | 미측정 항목에는 점수가 없다(`:80`이 검사). 테스트 점수는 입력값이다 |

## 감도 결함 상세 (BLOCK 사유)

- 프로브 입력: `IDS = [deepseek-free, mimo-free]`, `o = [deepseek 62.9]`, `r = [mimo 0.7]`, `w = [mimo 58]`.
- 정상 경로: `free-1+2`는 구성 불가다. 워커 후보는 mimo뿐이고 딥시크는 같은 실체라 제외된다. 중복 0.
- identityKey 누락 상태: `free-1+2`가 구성되고, 오케와 워커에 `deepseek-v4-1-flash-free`가 모두 들어간다. 중복 1.
- 권장 수정: 이 입력으로 `free-1+2`가 `feasible === false`(또는 중복 없음)임을 단언하는 테스트를 추가한다. 기존 `:68` 테스트도 같은 감도를 갖도록 입력을 조정하는 편이 좋다.

## 프로덕션·불변

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| 프로덕션 코드 변경 없음 | PASS | `find src config -newer tmp/yoroi-261-r4-validate.log` 결과 없음. 변경 파일 7개 집합은 이전과 같다 |
| 점수·순위·Free 표 값·댓글·publish | PASS | 이전 리뷰에서 확인한 diff 빈 결과와 같다. 이번 라운드 변경은 테스트 파일 1개(`tests/model-display.test.ts`)뿐이다 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-261-r5-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1462/1462 | 같은 로그 `ℹ tests 1462` / `pass 1462` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1055 files(`tmp/yoroi-261-r5-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `tests/insights-team-combinations.test.ts` 99, `tests/insights-letter-three-role-pipeline.test.ts` 100, `tests/model-display.test.ts` 89 |

## 비차단 메모

- N1 픽스처 점수 척도: 리뷰어 점수 0.68·0.74는 프로덕션(0~100)과 척도가 다르다. 단언에는 영향이 없지만 픽스처를 맞추면 좋다.
- N2 실데이터: 기대 조합은 여전히 합성 입력으로만 확인했다.

## 준수

코드·테스트·점수·순위·Free 표·댓글·publish를 바꾸지 않았다. 레포 파일은 건드리지 않았고, 누락 상태는 프로브 스크립트 안에서 풀 객체만 바꿔 흉내 냈다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
