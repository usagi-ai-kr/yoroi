# 발행 복구(publish recovery) 독립 리뷰 (2026-10-20)

- 최초 리뷰: w3(w18:p4). 대상: `src/composition/insights-publish.ts`·`insights-publish-target.ts`·`insights-publish-recovery.ts`
  + `tests/insights-publish-recovery.test.ts` + 리뷰 입력 `/tmp/yoroi-publish-recovery-env-review-report.json`.
- **소스 수정 0건.** 실제 원격 쓰기 없음(합성 러너만). 판정·근거는 본 문서에만 기록.
- **2026-10-20 최종판정(아래 §2): PASS — F1·F2 해소 확인.** 수정作者는 **w1**(`/tmp/yoroi-publisher-review-fix-report.json`),
  본 워커는 **reviewer**다(원 작성자 w2로 기록하지 않는다). root 추가 dedupe 수정 포함.

## 1. 최초 리뷰(수정 전) 판정: 조건부 PASS + 방어 공백 2건

| 확인 항목 | 최초 결과 | 근거(직접 확인) |
| --- | --- | --- |
| 다른 repo 쓰기 방지 | 조건부 PASS | `recoverMissingLetterComments`가 제목이 `[letter] `로 시작하고 'memo'를 포함하지 않을 때만 'not_a_letter'로 거부. `closePreviousLetters`는 `label=letter` open 이슈만 다룬다 → memo·비레터 이슈 미접촉. **단, create 경로의 canonical repo 검증이 호출되지 않음(F1)** |
| memo/non-target 방지 | PASS | 제목 게이트 + 라벨 스코프. 테스트가 memo 제목을 실제로 거부함을 확인 |
| create canonical URL 검증 | **F1 (MEDIUM-LOW)** | `isCanonicalOrRedirectRepo`는 **정의만 있고 호출 없음**. publish.ts가 URL에서 **이슈 번호만** 추출하고 repo는 버린다 → gh 출력이 다른 repo URL이면 그 번호가 REPO의 무관한 이슈로 쓰일 수 있음 |
| 실제 comment 오류 처리 | PASS | gh exit≠0 → `fail('comment N failed (issue #N left open)')`로 이슈를 open으로 남김. 복구 경로도 'failed'+sanitize 오류 |
| 누락만 복구·중복 방지 | (수정 전) 부분 | 기존 댓글 **개수**만 세어 `currentCount` 이후 파일만 게시 → 무관한 댓글 있으면 앞 상세 댓글을 건너뛸 수 있음 |
| **입력 본문 다르면 복구 차단** | **F2 (MEDIUM)** | 미구현. 복구 경로가 `gh issue view`로 **댓글 수만** 조회하고 본문을 조회·비교하지 않음 → 본문(Top7)이 달라진 상태에서 댓글을 붙이면 근거 불일치 |
| 댓글 순서·close 시점 | PASS | c-1..c-3 순서 게시 후에만 `closePreviousLetters` 호출(create·복구 양 경로) |
| 로그 위생 | PASS | `sanitizeLogOutput`이 sk-/gh*_/bearer 패턴 마스킹 |

## 2. 최종 판정: PASS — F1·F2 해소 (수정: w1, 검증: 본 워커)

| 확인 항목 | 최종 결과 | 직접 확인 근거 |
| --- | --- | --- |
| canonical 검증 함수가 실제 호출되는가 | **해소** | `insights-publish.ts:70` — `if (!extracted || !isCanonicalOrRedirectRepo(extracted.repo)) return fail(...)` (호출 확인) |
| canon/redirect URL 정당 통과 | PASS | `extractIssueUrlAndNumber`가 `qus0in/yoroi`·`usagi-ai-kr/yoroi` 둘 다 허용, 테스트 'supports usagi-ai-kr canonical URL on creation' 통과 |
| 다른 repo / 비github / 이상한 다중 URL 거부 | PASS | 경계 테스트 3건(다른 repo·URL 없는 출력·다른 repo URL이 먼저 나오는 다중 출력) 모두 **게시 0건 + exit 1** |
| 기존 issue body exact compare 게이트 | **해소** | `recoverMissingLetterComments(..., expectedBody)`가 `gh issue view --json body`를 읽어 **정확 비교**(`!==`)하고, 불일치·미확보 시 'failed'(게시 0건, 이슈 open 유지). publish.ts:58이 렌더 본문을 `expectedBody`로 전달 |
| 무관한 댓글 있어도 앞 상세 skip 안 함 | **해소** | 기존 댓글이 ['human note','c1']일 때 **c2·c3만** 게시(recoveredCount 2) — 개수 기반 skip 제거, 본문 일치 기반 판정 |
| 같은 본문 중복 게시 금지 | PASS | `posted = new Set(existing)` + `posted.has(expected) → continue` |
| memo·title·안전한 close 계약 유지 | PASS | 'not_a_letter' 게이트(recovery.ts:38-39)·`label=letter` 스코프·create/복구 양 경로의 `closePreviousLetters` 호출 그대로 |
| 집중 검증 | PASS | `node --import ./tests/harness-setup.mjs --import tsx --test "tests/insights-publish*.test.ts"` → **18 pass / 0 fail, exit 0** (기존 4 + 경계 5 = 회귀 9건 포함). `validate-repo.py` → **PASS 860 files, exit 0**(작업 중 123줄이던 스냅샷은 최종 82/64/71/93/77/32줄로 정리됨) · `git diff --check` exit 0 |

## 3. 독립 리뷰의 scope 근거(무엇을 확인했고 무엇을 확인하지 않았는지)

- **확인**: publisher 3파일·테스트 2파일의 실제 코드(읽기 전용), F1 게이트의 실제 호출 지점, F2 본문 게이트의 호출·정확 비교, 부족 댓글 산정 방식,
  memo/title/close 계약 유지, 집중 합성 테스트 9건 재실행, validator·diff 체크.
- **미확인(본 리뷰 범위 밖)**: ① **실제 GitHub API 동작** — 모든 검증은 합성 러너다(실 gh 호출 0건). ② **인증·OS 격리**는 별도 건
  (`calibration-env-acceptance-review.md`)이며 여기 포함하지 않는다. ③ **전체 check**는 w1 보고값(단위 1197/1197·BDD 45/635·build·validate 859)을 신뢰하고
  중복 실행하지 않았다(의미 없음). ④ **#192 실게시 경로**는 자동 publisher가 아니라 **검증된 artifact 수동 게시**로 이미 완료되었으므로 재게시하지 않았다.
  ⑤ Free 목록 동일성(c2)은 별도 리뷰(`letter1020-restore-acceptance-review.md`)의 사안.
- **운용상 잔여(차단 아님)**: 본문 게이트는 정확 비교이므로 GitHub가 본문을 정규화한 경우(끝 개행 등) 복구를 거부한다(fail-closed 방향).
  #192 사례에서는 원격 본문과 렌더 본문이 sha256까지 일치해 영향이 없음을 확인했다.

## 4. 남은 일

- publisher F1·F2는 **해소 확인** — root의 차단 항목에서 제외 가능.
- PR·issue·커밋은 총괄이 처리. 본 리뷰는 소스 수정·원격 쓰기·커밋 없음.
