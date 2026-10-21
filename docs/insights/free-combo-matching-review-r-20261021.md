# Free 조합 정합·차선 캡션·표시 규칙 독립 리뷰 r (2026-10-21, #260·#261)

- 이슈: [#260](https://github.com/usagi-ai-kr/yoroi/issues/260), [#261](https://github.com/usagi-ai-kr/yoroi/issues/261). 패킷 `yoroi-260-261-review-r`. 요구사항: [free-combo-matching-dispatch-20261021.md](free-combo-matching-dispatch-20261021.md).
- 대상: 미커밋 변경. 신규 `src/insights/model-display.ts`(48줄), `config/model-display-rules.json`, `src/insights/letter-team-runners.ts`(44줄, `freePolicyPool`). 수정 `letter-team-combinations.ts`(98줄), `letter-mermaid.ts`(61줄), `letter-three-role-pipeline.ts`(99줄), `letter-markdown-free-table.ts`(표시명만), `letter-three-role-render.ts`(모델 셀만), `composition/insights-three-role.ts`(96줄), 테스트 5개. 기준 HEAD `148e777`.
- 방법: 수정 코드 전체 읽기, 합성 입력 프로브(`tmp/yoroi-260-r-probe.ts`, 리뷰 후 삭제), 불변 파일 diff, 검증 재실행. 실데이터 확인과 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**BLOCK**. Free 조합 안에서 같은 모델이 두 번 나온다. 중복 제외 규칙(#253: 조합 내 identityKey 유일)이 깨진다. 중복 때문에 기대한 Beam 워커 fallback이 빠진다. 미측정 Free 후보가 오케·리뷰어 차선으로도 나온다. 두 가지를 고쳐야 한다.

## BLOCK 1: 조합 내 같은 실체 중복

- 증거: 프로브 합성 입력(딥시크 Free 측정 85 오케, 미니맥스 Free 측정 82 리뷰어, 미마 Flash 70·GLM Flash 65 워커, 베이크 미측정). `free-1+1+3`: `orchestrator:deepseek-v4-1-flash-free(F):85`, `worker:deepseek-v4-1-flash-free(F):NA`.
- 원인: `letter-team-runners.ts` `freePolicyPool`의 미측정 항목 `{ modelId: id, free: true }`에는 `identityKey`가 없다. 그래서 `resolveIdentityKey`가 `-free` 접미사가 남은 키를 쓰고, 측정 항목(`deepseek-v4-1-flash`)과 다른 키가 된다. 중복 검사(`letter-team-combinations.ts:66`)를 통과한다.
- 결과: 베이크 미측정(점수 0)과 중복 딥시크(점수 0)가 같은 0점이라 먼저 나온 쪽이 선택됐다. 기대 결과인 Beam 워커 fallback이 나오지 않았다.
- 해소: 미측정 항목에도 정규 identityKey(`canonicalModelId`)를 부여한다. 회귀 테스트를 추가한다. 측정 딥시크가 오케에 있으면 Free 딥시크가 워커에 들어가지 않아야 하고, Beam이 그 자리를 채워야 한다.

## BLOCK 2: 미측정 Free가 오케·리뷰어 풀에 들어감

- 증거: `freePolicyPool`은 Free 목록의 각 모델을 `o`·`r`·`w` 세 풀 모두에 넣는다. 프로브 `free-1+1+3` 캡션: `- 🧭 오케스트레이터: beam 🆓`, `- 🔍 리뷰어: beam 🆓`, `- 🛠️ 워커: beam 🆓`.
- 계약 충돌: #257 계약은 Free를 워커 fallback으로만 쓰도록 했다(무점수·필요 시만). #261 요구사항의 "Beam은 점수 없는 Free fallback으로 필요 시만"도 같은 취지다. 미측정 오케·리뷰어 차선은 이 계약과 어긋난다.
- 해소: 미측정 Free는 워커 풀에만 두거나, 계약을 명시적으로 바꾼다. 사용자 결정 사항이다.

## 확인된 항목

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| #260 표시 규칙 적용 | PASS | `model-display.ts`(규칙 위→아래 적용, 최대 4회). 노드 `🧭 오케스트레이터 · deepseek-v4-1-flash 🆓`, 캡션, 3역할 `modelCell`(`letter-three-role-render.ts`), Free 표 행 이름(`freeDisplayId`)에 적용 |
| 표시 규칙이 내부 값을 바꾸지 않음 | PASS | 자격 판정 외에는 표시 함수만 바뀜. 점수·순위·Free 값 파일(`letter-markdown-free.ts`, `letter-markdown-free-sort.ts`, `letter-markdown-tables.ts`)은 HEAD와 같다 |
| #261 canonical 매칭 | PASS | `freePolicyPool`이 `canonicalModelId`로 Free 목록과 측정 목록을 맞춘다. 프로브: `*-free` → 측정 점수 85·82·70·65가 붙음 |
| 유료 Kimi K3·MiMo Pro·GLM 5.3 제외 | PASS | 프로브: Free 조합에 `mimo-v2-6-pro`(오케 89), `glm-5-3`(리뷰어 88), `kimi-k3`(워커 90)이 없다. Free 목록에 있는 모델만 후보 |
| 1+2 리뷰어 차선 없음 | PASS | 프로브 `free-1+2` 캡션: 오케·워커 라인만 |
| 캡션은 역할별 개별 라인, 펜스 밖 | PASS | `letter-mermaid.ts` `runnersUpCaption`: `**🥈 차선**` 뒤 `- 🧭/🔍/🛠️ 역할: 모델`. 파이프라인이 펜스 뒤에 붙인다 |
| 후보 없음 `-` · 구성 불가 | PASS | 이전 리뷰 확인(구성 불가는 차선 없음 → `-`) |
| 조합 모델 재사용 금지 | PASS(조건부) | 프로브 캡션에 조합 밖 모델만 나옴. 단 BLOCK 1 때문에 같은 실체 중복은 막히지 않는다 |
| 제목 뱃지·Mermaid 이모지·Free 🆓 | PASS(구문) | `combinationBadges`가 `![best](…/🥇_가장_최선-1+1+3-blue)`와 `![free](…/🆓_Free-1+1+3-2ea44f)`를 만든다. GitHub 실제 렌더는 확인하지 않았다 |
| Free 총점은 측정 슬롯만·미측정 별도 | PASS | `letter-team-combinations.ts:67-68`(이전 리뷰 확인). 프로브 `free-1+1+3` total 302 = 85+82+70+65, unmeasured 1 |
| Top7/Top15·Free 표·댓글·publish·2역할 | PASS | `letter-markdown.ts`, `letter-markdown-tables.ts`, `letter-three-role.ts`, `letter-role-selection.ts`, `insights-publish.ts`, `insights-cli.ts`, `letter-three-role-body.ts`, 정책 파일 diff 빈 결과 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-260-r-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1460/1460 | 같은 로그 `ℹ tests 1460` / `pass 1460` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1053 files(`tmp/yoroi-260-r-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | 가장 긴 파일 `letter-team-combinations.ts` 98, `letter-three-role-pipeline.ts` 99 |

## 필수 수정 (BLOCK 해소 조건)

1. `freePolicyPool`의 미측정 항목에 정규 `identityKey`를 부여하고, 같은 실체 중복을 막는 회귀 테스트를 추가한다.
2. 미측정 Free의 역할 범위를 확정한다. 워커 풀 한정이면 `freePolicyPool`을 워커만 채우도록 고치고, 오케·리뷰어 차선 캡션에서 미측정 Free를 뺀다.

## 비차단 메모

- N1 실데이터: 기대 조합(딥시크 O, 미니맥스 R/W, GLM Flash W, Beam fallback)은 합성 입력으로만 확인했다. 실제 카탈로그로는 확인하지 않았다.
- N2 뱃지 렌더: 이모지와 유니코드가 든 shields 주소의 GitHub 렌더는 실제로 확인하지 않았다.
- N3 오픈 웨이트 레지스트리: Free 정책으로 바뀌면서 조합 코드에서 더 이상 쓰이지 않는다. 사용처와 테스트를 정리하면 좋다.

## 커밋·발행 게이트

- 커밋 범위는 BLOCK 해소 후 확정한다. 신규 파일(`model-display.ts`, `config/model-display-rules.json`, `tests/model-display.test.ts`, `letter-team-runners.ts` 등)을 빠뜨리지 않는다.
- 발행 전에 BLOCK 1·2를 해소하고 커밋 범위에서 `pnpm run check`를 다시 돌린다.

## 준수

코드·테스트·점수 가중치·순위·Free 표 값·발행 계약을 바꾸지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
