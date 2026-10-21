# Free 후보 풀 수정 재리뷰 r (2026-10-21, #261)

- 이슈: [#261](https://github.com/usagi-ai-kr/yoroi/issues/261), [#260](https://github.com/usagi-ai-kr/yoroi/issues/260). 패킷 `yoroi-261-free-pool-fix-rereview-r`. 요구사항: [free-combo-matching-dispatch-20261021.md](free-combo-matching-dispatch-20261021.md). 이전 리뷰: [free-combo-matching-review-r-20261021.md](free-combo-matching-review-r-20261021.md)(BLOCK 2건).
- 대상: 미커밋 수정분. 핵심은 `letter-team-runners.ts`의 `freePolicyPool`(53줄)이다. 함께 바뀐 파일은 `letter-team-combinations.ts`(98줄), `letter-mermaid.ts`(61줄), `letter-three-role-pipeline.ts`(99줄), `composition/insights-three-role.ts`(96줄), `model-display.ts`(48줄), 테스트 여러 개다. 기준 HEAD `148e777`.
- 방법: `freePolicyPool` 전체 읽기, 이전 BLOCK 재현 입력(미니맥스 워커 68점을 추가)으로 프로브(`tmp/yoroi-261-r4-probe.ts`, 리뷰 후 삭제), 불변 파일 diff, 검증 재실행. 실데이터와 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**PASS(조건부)**. 두 BLOCK의 동작은 모두 해소됐다. 조건은 하나다. 이전 리뷰가 요구한 회귀 단언(중복 방지, O/R 측정 한정)을 발행 전에 추가해야 한다. 테스트 추가는 코드 변경이므로 이번 리뷰에서 하지 않았다.

## BLOCK 1 해소: 같은 실체 중복

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 모든 Free 후보에 캐노니컬 identityKey | PASS | `letter-team-runners.ts:47` 측정·미측정 모두 `identityKey: key`(`canonicalModelId`) |
| 딥시크와 딥시크-free가 한 조합에 없음 | PASS | 프로브 `free-1+1+3`: `dup=false`. 오케 `deepseek-v4-1-flash-free`, 워커는 Beam |
| Free 후보 풀 내부 중복 제거 | PASS | `letter-team-runners.ts:37-42`가 캐노니컬 키로 `unique` 중복을 제거 |

## BLOCK 2 해소: 미측정 Free의 오케·리뷰어 유입

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 오케·리뷰어 풀은 측정 후보만 | PASS | `letter-team-runners.ts:51` `o`·`r`에 `measuredOnly`. `w`만 미측정을 포함 |
| 캡션 O/R 차선에 미측정 없음 | PASS | 프로브 `free-1+1+3` 캡션: `🧭 -`, `🔍 -`, `🛠️ -`. 오케·리뷰어 차선에 `beam` 없음 |
| 미측정은 워커 fallback만 | PASS | 프로브 `free-1+1+3` 워커: mimo 70, glm 65, `beam-free:NA` |

## 기대 조합 확인 (합성 입력)

| 기대 | 결과 | 근거 |
| --- | --- | --- |
| 1+1+3: O deepseek → R minimax → W mimo-flash/glm-flash/beam | PASS | 프로브 `free-1+1+3`: O `deepseek-v4-1-flash-free:85`, R `minimax-m3-1-flash-free:82`, W mimo 70, glm 65, beam NA |
| 1+2: O deepseek → W minimax/mimo-flash | PASS | 프로브 `free-1+2`: O deepseek 85, W mimo 70, minimax 68. 미니맥스 워커 점수 68은 합성 입력이다 |
| MiniMax·Beam 등장, 유료 Kimi·MiMo Pro·GLM 5.3 없음 | PASS | 유료 모델은 높은 점수(89·88·90)를 가져도 Free 목록에 없어 제외됨. 미니맥스·Beam은 등장 |
| 실데이터 기대 | 미확인 | 실제 카탈로그와 실측 워커 점수는 확인하지 않았다 |

## 캡션·뱃지·이모지

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 역할별 개별 라인 🧭/🔍/🛠️ | PASS | `letter-mermaid.ts` `runnersUpCaption`: `**🥈 차선**` 뒤 `- 🧭 오케스트레이터: …` 등 |
| 1+2 리뷰어 라인 없음 | PASS | 프로브 `free-1+2` 캡션에 🧭·🛠️만 있음 |
| 펜스 밖, 순서 | PASS | `letter-three-role-pipeline.ts:76` 제목+뱃지 → 펜스 → 캡션 |
| Free 🆓 표시 | PASS | 노드 `🆓`, 캡션 `glm-5-3-flash 🆓` |
| 뱃지 구문 | PASS(구문) | `![free](https://img.shields.io/badge/🆓_Free-1+1+3-2ea44f)`. GitHub 실제 렌더는 확인하지 않았다 |
| 후보 없음 `-` | PASS | 프로브 `-` |

## 불변·점수

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| totalScore 측정 합산·미측정 분리 | PASS | 프로브 `free-1+1+3`: total 302(=85+82+70+65), unmeasured 1(Beam) |
| Top7/Top15·댓글·publish·2역할 | PASS | `letter-markdown.ts`, `letter-markdown-tables.ts`, `letter-markdown-free-sort.ts`, `letter-three-role.ts`, `letter-role-selection.ts`, `insights-publish.ts`, `insights-cli.ts`, `letter-three-role-body.ts`, 정책 파일 diff 빈 결과 |
| Free 표 값 | PASS | `letter-markdown-free-table.ts` 변경은 `freeDisplayId`(표시명) 한 줄뿐 |
| 측정 점수 이전 | 메모 | Free 변형은 같은 기반 모델의 측정 점수를 그대로 받는다(캐노니컬 매칭). 설계 의도로 보이므로 문서에 명시하는 편이 좋다 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-261-r4-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1460/1460 | 같은 로그 `ℹ tests 1460` / `pass 1460` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)`, `635 steps` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1054 files(`tmp/yoroi-261-r4-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `letter-team-combinations.ts` 98, `letter-three-role-pipeline.ts` 99, `composition/insights-three-role.ts` 96, `letter-team-runners.ts` 53 |

## 조건과 비차단 메모

- C1(발행 전 필수): 회귀 단언을 추가한다. (a) Free·base 중복이 한 조합에 없음, (b) `freePolicyPool`의 `o`·`r`에 미측정 항목이 없음. 현재 `tests/model-display.test.ts:44-55`는 매칭·점수·유료 제외만 단언한다.
- N1 실데이터: 기대 조합은 합성 입력으로만 확인했다.
- N2 뱃지 렌더: GitHub 실제 렌더는 확인하지 않았다.
- N3 점수 이전 가정: 같은 기반 모델의 측정 점수를 Free 변형에 그대로 쓴다. 문서에 명시하는 편이 좋다.

## 커밋·발행 게이트

- C1을 추가한 뒤 커밋 범위에서 `pnpm run check`를 다시 돌린다.
- 커밋 범위에는 신규 파일(`model-display.ts`, `config/model-display-rules.json`, `tests/model-display.test.ts`, `letter-team-runners.ts`)을 빠뜨리지 않는다.

## 준수

코드·테스트·점수 가중치·순위·Free 표 값·발행 계약을 바꾸지 않았다. 점수를 새로 만들지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
