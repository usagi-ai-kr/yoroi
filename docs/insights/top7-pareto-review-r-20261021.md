# Top7 파레토 열 제거 독립 리뷰 r (2026-10-21)

- 이슈: [#245](https://github.com/usagi-ai-kr/yoroi/issues/245). 패킷 `yoroi-245-top7-pareto-review-r`. 요구사항: [top7-pareto-dispatch-20261021.md](top7-pareto-dispatch-20261021.md).
- 대상: w1의 #245 미커밋 변경 8개 파일(렌더 2·테스트 6). 기준 HEAD `29332dc`.
- 방법: `git diff` 직접 대조, 그리고 HEAD에 #245 8개 파일만 얹은 격리 사본의 렌더 덤프를 HEAD 덤프와 바이트 비교. 자기신고는 근거로 쓰지 않았다.

## 판정

**PASS**(#245 코드·테스트·문서 범위). 커밋·재발행 게이트는 아래 **D**를 먼저 충족해야 한다.

## 항목별 근거

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 3역할 본문 Top7 5열, 파레토 없음 | PASS | `src/insights/letter-three-role-render.ts:80` `withPareto = depth === 15`. 격리 덤프 `threeBody`: 헤더 `순위·모델·스코어·effort·실사용` 3회, 👍 행 0 |
| 3역할 Top15 댓글 6열, 파레토 유지 | PASS | `src/composition/insights-cli.ts:34-36`이 depth 15로 호출. `threeC0`: 6열 헤더, 👍 6행 |
| 2역할 본문 Top7 파레토 없음 | PASS | `src/insights/letter-markdown.ts:51-52` `renderRoleTable(…, 7, false)` → `letter-markdown-tables.ts:14`. `twoBody`: 헤더 2종 모두 파레토 없음, 👍 0 |
| 2역할 Top15 댓글 파레토 유지 | PASS | `letter-markdown.ts:57-58` 기본 인자 → `withPareto=true`. `twoC0`: 파레토 헤더, 👍 1행 |
| Free 표 불변(비고 👍·점수·순위·댓글 수·Free 열) | PASS | Free 경로 파일 미변경. 격리 덤프 `twoC2`·`threeC2`가 HEAD와 바이트 동일 |
| 본문 점수·순위·effort·모델 | PASS | HEAD 본문에서 3번째 필드(파레토 셀)만 제거하면 격리 본문과 일치(2역할·3역할 모두) |
| `isPareto` 데이터 유지 | PASS | `src/composition/insights-three-role.ts:33` 전달 경로 미변경, 렌더만 조건부 |
| dispatch 문서 "2·3역할 동일 규칙" | PASS(메모 B) | 실제 호출값(7·15)에서는 동일. 구현 표현은 다름 |

## 검증

`pnpm run check`를 구성 단계별로 실행했다(typecheck → test → bdd → build).

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | 워킹트리 `TYPECHECK_EXIT=0`, 격리 `TC=0` (`tmp/yoroi-245-r-check.log`, `tmp/yoroi-245-r-iso.log`) |
| node:test | PASS 1432/1432 | 워킹트리·격리 모두 `ℹ tests 1432`, `ℹ pass 1432`, `ℹ fail 0` |
| BDD | PASS 45/45 | 워킹트리·격리 모두 `45 scenarios (45 passed)`, `635 steps (635 passed)` |
| build | PASS | `tsc -p tsconfig.json --outDir tmp/…` exit 0 (`dist/` 미사용) |
| validate-repo | 아래 최종 실행 결과 | `python3 scripts/validate-repo.py` |
| diff-check | PASS | `git diff --check` exit 0 |
| 파일 100줄 | PASS | render 93, tables 28, 변경 테스트 최대 100(`insights-markdown`·`insights-model-role-fit`) |

## 비차단 후속 (수정 없음, w1·오케스트레이터 판단)

- **A 범례 문구**: `src/insights/letter-top10-legend.ts:47`의 `👍 파레토 최적(파레토 열)`이 2역할 본문에 남는다(`twoBody` 1건). 발행 경로(3역할 on)는 `letter-three-role-body.ts:36·39`의 `replaceLetterGuide`로 `THREE_ROLE_LEGEND`(열 언급 없음)로 바뀌므로 발행 본문에는 영향 없다. 기본 off 경로 출력만 해당한다.
- **B 암묵 기본값**: `renderRoleTable`의 `withPareto = rowLimit !== 7`는 매직 넘버다. 호출부에 명시 인자로 두는 편이 안전하다.
- **C 테스트 공백**: 2역할 본문 행의 👍 부재와 Free 불변을 직접 단언하는 신규 테스트가 없다. 헤더 개수(`tests/insights-markdown.test.ts`)와 기존 Free 테스트로만 간접 커버된다.

## 차단 조건·재발행 위험

- **D 작업 트리 오염(커밋·발행 전 필수 확인)**: 리뷰 중 다른 작업의 미커밋 변경이 나타났다. `src/insights/letter-markdown-free-sort.ts`(mtime 11:46:56, #245 스냅샷 11:46:07 이후), `letter-markdown-free.ts`, `tests/insights-free-reviewer-table.test.ts`, 신규 `docs/insights/free-sort-criterion-*-20261021.md`. Free 정렬 키(`freeRowOrder`)와 정렬 설명 문구를 바꾼다(코드 주석 #246). #245 판정 대상이 아니다.
  - 위험: `git add -A`나 `commit -a`로 #245 커밋에 섞인다. 워킹트리 기준으로 발행하면 미검토 Free 정렬이 나간다.
  - 조건: #245 커밋은 8개 파일을 명시 경로로만 스테이징한다. 재발행은 HEAD+#245 상태이거나 #246 리뷰 이후에만 한다.
- **E 독자 영향**: 본문 Top7에서 👍 열이 사라지고 댓글 Top15의 👍은 유지된다. 점수·순위·순서는 HEAD와 같다(격리 검증).
- **범위 밖 미커밋 변경(손대지 않음)**: `docs/orchestration.md`(r 패인 `w18:p6`→`w18:p7`), untracked `docs/insights/top7-pareto-review-20261021.md`.

## 준수

코드·테스트·가중치·파레토 계산·Free 표를 바꾸지 않았다. 외부 쓰기, 레터 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서와 무시 대상 `tmp/`뿐이다. 로그는 `tmp/yoroi-245-r-check.log`, `tmp/yoroi-245-r-iso.log`.
