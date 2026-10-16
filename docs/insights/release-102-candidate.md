# 1.0.2 clean 후보 준비 (w1, `yoroi-102-candidate-w1`, 2026-10-16)

- 범위: `release-102-final-task.md` 첫 단계 — 원격 상태 확정 + clean 후보·manifest 준비. 커밋·push·PR·merge·tag/Release·전역·레터는 이번 단위 없음.
- 소유: 본 문서 · `/tmp/yoroi-102-final-clean` · `/tmp/yoroi-102-final-manifest.json` · `/tmp/yoroi-102-final-build-clean.py` · report JSON. ROOT dirty는 읽기만.

## 원격 상태 (읽기전용, 2026-10-16 05:44Z)

- `git ls-remote`: main `9cd019015a680e0e57bdc1ac3b1df14bb368f074`(= PR #166 "Merge pull request #166"), dev `4b30f72…`.
- tag는 v1.0.0·v1.0.1뿐 — **v1.0.2 tag 없음**. `gh release list` 최신도 v1.0.1 — **v1.0.2 Release 없음**. package.json 1.0.2 유지(기존 tag 없음 조건 충족).
- `git log --left-right`: main = dev + merge 1개(`> 9cd0190`) — dev 내용은 main에 포함.

## 후보 (builder `/tmp/yoroi-102-final-build-clean.py`, 54줄)

- BASE `9cd0190` `git archive` + 허용 working files **45개** 복사(추적 15·신규 30). 파일별 sha256은 manifest `files`에 기록. (commit 단계에서 완료준비 문서 2건 — `release-102-candidate-review.md`·`release-102-letter-preparation.md` — 을 추가 포함해 최종 후보는 47개다.)
- 제외(dirty5, ROOT 보존): `letter-top10-score.ts`(현재 diff가 1.1 worker hunk 전용 → 파일 전체 제외, 후보는 main 버전), `four-source-score.md`(동일: 1.1 전용), `orchestration.md`, takeover 문서, `worker-effort-source.test.ts`.
- 제외(진척·인계·제안 — 릴리스 트리 불필요, 중복 방지): active-worker-assignment·handoff-final-review-record·handoff-followup·handoff-integration-verification·uncommitted-preservation-review·letter-ban-implementation-plan(#163 제안)·adaptive-model-discovery-issue(#168 제안).
- 본 문서는 후보에 **포함**한다: `release-status.md`가 이 문서를 링크하는데 제외하면 docs-links 계약 테스트가 깨진다(1차 44파일 빌드에서 실측).
- 포함(승인 범위): #164 warn(`pace.ts`·`render-pretty-filter.ts`·usage-status 테스트·`architecture.md`·usage-warn 문서·output-contract) / #165 argon(`labels.ts`·window-labels 테스트·`plan-catalog.ts`·plan-catalog 테스트·argon 테스트·argon 문서 6) / #167 muse(`model-aliases.ts`·model-aliases 테스트·plan-catalog 공유·muse 테스트·muse 문서 7) / R 문서(`orchestrator-r-release-task`·role-score 5) / `release-102-final-task`·`release-102-review-plan` / `release-status`·`tasks`(미발행·범위 갱신).
- 제외 검증: 후보에 `aaFallback`(1.1 fallback)·four-source worker 행·worker-effort-source·takeover 부재, 허용 파일 존재 확인.

## 후보 clean 검증 (45파일 최종, 2026-10-16)

- **unit: PASS 1060/1060**(fail 0, log `/tmp/yoroi-102-unit2.log`) — 기존 통합 1062와 차이 2는 제외된 `insights-worker-effort-source.test.ts` 몫이다. 1차 44파일에서는 docs-links 1건 실패(본 문서 링크 대상 누락) → 본 문서 포함 재빌드로 해소.
- **BDD: PASS 45 시나리오/632 스텝**(log `/tmp/yoroi-102-bdd2.log`).
- **typecheck PASS · build PASS · validate-repo PASS**(709 files, 7 skills) — `node dist/src/main.js --version` = `yoroi 1.0.2`.
- 후보 전용: node_modules는 심볼릭 링크(설치 없음), dist는 후보 트리 내 산출. 결과 요약은 manifest `verification`에 기록.

## 보존

- ROOT는 읽기만: 검증 전후 본 단위가 바꾼 것은 `release-status.md`·`tasks.md`(미발행·범위 갱신)와 본 문서뿐 — 기존 16파일 diff 해시 `a607488f…` **동일**(전후 재계산 일치). dirty5 5개 파일 해시 기록(`/tmp/yoroi-102-dirty5-hashes.txt`). 삭제·stash·reset·stage 없음.

## 후속

- 다음 단계: w3 독립 리뷰 → commit 분리(사용자 승인 범위). tag/Release/global/letter 없음, 원본 dirty5 보존.
