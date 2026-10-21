# 추천 조합 BLOCK 수정 재리뷰 r (2026-10-21, #256·#257)

- 이슈: [#256](https://github.com/usagi-ai-kr/yoroi/issues/256), [#257](https://github.com/usagi-ai-kr/yoroi/issues/257). 패킷 `yoroi-257-block-fix-rereview-r`. 요구사항: [team-top15-free-runners-dispatch-20261021.md](team-top15-free-runners-dispatch-20261021.md). 이전 리뷰: [team-top15-free-runners-review-r-20261021.md](team-top15-free-runners-review-r-20261021.md)(BLOCK).
- 대상: 미커밋 수정분. `letter-team-combinations.ts`(100줄), `letter-mermaid.ts`(46줄), `letter-team-runners.ts`(21줄), `letter-three-role-pipeline.ts`, `composition/insights-three-role.ts`, 테스트 3개, 레지스트리 `config/open-weight-models.json`(14줄). 기준 HEAD `bcc9de5`.
- 방법: 수정 코드 전체 읽기, 실제 함수를 쓴 프로브(`tmp/yoroi-257-r2-probe.ts`, 리뷰 후 삭제), 불변 파일 diff, 검증 재실행. 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**PASS**. 이전 BLOCK(총점에 Free를 0점으로 합산)이 해소됐다. 구성 불가 차선 `-`와 캡션 이스케이프도 확인됐다. 새 차단 사유는 없다.

## BLOCK 해소 근거

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 총점은 측정 슬롯만 합산 | PASS | `letter-team-combinations.ts:68` `s.score === undefined ? sum : sum + s.score`. 프로브 best-1+1+3: 총점 305(=90+85+70+60), 미측정 1 |
| 미측정 수 별도 노출 | PASS | `TeamCombination.unmeasured`(`:18-19`), 집계(`:68`), 노출(`:84`). 테스트 `mermaid.test.ts:57-67`: 총점 240(=90+80+70), 미측정 2 |
| 비교: 측정 총점 desc → 미측정 asc → 선착 | PASS | `:69` `total > best.total \|\| (total === best.total && unmeasured < best.unmeasured)`. 후보는 정렬된 순서로 열거되므로 결정론적 |
| 점수 조작 없음 | PASS | 프로브: Free 슬롯은 `score` 없음(표시 `NA`). 점수를 만드는 코드는 없다 |

## 캡션·구성 불가 확인

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 구성 불가 조합 차선은 `-` | PASS | `:85` `runnersUp: {}`. 프로브 open-1+1+3: `- 차선: 오케스트레이터 - · 리뷰어 - · 워커 -`. 테스트 `mermaid.test.ts:68` |
| 차선 모델 id 이스케이프 | PASS | `letter-mermaid.ts:36` `escapeCaptionId`(백틱·CR/LF를 공백으로, 공백 정리, 80자). 프로브 `bad`·`\n`·` ``` `x` → `bad x`. 테스트 `:72` |
| Free 표기 유지 | PASS | 노드 `· Free`(`:28`), 캡션 `(Free)`(`:42`). 프로브: `worker:free-a(free)`, `워커 free-a (Free)` |

## 나머지 불변

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| Top15 후보 | PASS | 파이프라인 조합 연결부가 `selection.*.top15`를 쓴다(`letter-three-role-pipeline.ts`) |
| Free 워커 fallback(무점수·필요 시만) | PASS | 프로브: 점수 워커 2명일 때만 `free-a`가 3번째 슬롯에 들어감. 정렬상 미측정은 항상 뒤(`letter-team-runners.ts:9-10`) |
| 차선 1개/역할, 조합 모델 제외, 1+2 리뷰어 차선 | PASS | 프로브 open-1+2: `리뷰어 r1`. `runnersUp`이 `picked`를 제외 |
| 캡션은 펜스 밖, Mermaid에 차선 노드 없음 | PASS | `letter-three-role-pipeline.ts:70` 펜스 뒤에 캡션. 프로브 Mermaid에 차선 노드 없음 |
| Top7/Top15·Free 표·댓글·publish·2역할 | PASS | `letter-markdown*.ts`, `letter-three-role.ts`, `letter-role-selection.ts`, `letter-three-role-render.ts`, `insights-publish.ts`, `insights-cli.ts`, `letter-three-role-body.ts`, 정책 파일이 HEAD와 같다(diff 빈 결과). 파이프라인과 컴포지션 변경은 조합 연결과 Free 전달뿐이다 |
| Mermaid 고정 ID·라벨 이스케이프·펜스 | PASS | `letter-mermaid.ts:18-33` 고정 `O/R/W1..`. `:12` 라벨 이스케이프. `mermaidFence`로 고정 펜스 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-257-r2-check.log`의 `TYPECHECK_EXIT=0` |
| node:test | PASS 1449/1449 | 같은 로그 `ℹ tests 1449` / `pass 1449` / `fail 0` |
| BDD | PASS 45/45 | `45 scenarios (45 passed)`, `635 steps (635 passed)` |
| build | PASS | `BUILD_EXIT=0`(tmp outDir) |
| validate-repo | PASS | exit 0, 1045 files(`tmp/yoroi-257-r2-validate.log`) |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | `letter-team-combinations.ts` 100줄(한계 도달), 테스트 최대 100줄, `letter-mermaid.ts` 46줄 |

## 비차단 메모

- N1 동점 규칙 테스트 공백: "측정 총점 동점 → 미측정 asc" 규칙을 직접 단언하는 테스트가 없다. 정렬 순서상 미측정이 뒤라 현재 결과는 같지만, 규칙 회귀를 막을 단언이 필요하다.
- N2 미측정 표시: `unmeasured`는 데이터에만 있고 캡션·라벨에는 나오지 않는다. 표시 구분은 "· Free" 라벨로만 이루어진다. 계약의 "표시 구분"은 충족한다.
- N3 캡션 특수문자: `*`·`_`·`[`·`]`·`<`·`>`는 이스케이프하지 않는다. 구조를 깨뜨리지는 않으므로 보기가 어색한 정도다.
- N4 줄 수 한계: `letter-team-combinations.ts`가 정확히 100줄이다. 다음 수정에서는 helper 분리가 필요하다.
- N5 라이선스: Muse·MiniMax 라이선스는 여전히 "미확인"이다(이전 리뷰 N3 유지). 발행 전에 사용자가 수용 여부를 확인해야 한다.

## 커밋·발행 게이트

- 커밋 범위는 이전 리뷰와 같다(수정 10개, 신규 3개). 커밋 범위만으로 `pnpm run check`를 다시 돌린다.
- 발행 전에 N5를 사용자가 확인한다.

## 준수

코드·테스트·Top7 순위·Free 표·발행 계약·점수를 바꾸지 않았다. 점수를 새로 만들지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
