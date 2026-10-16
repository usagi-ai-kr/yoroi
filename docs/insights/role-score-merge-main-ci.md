# 1.0.2 PR #166 머지·main CI (2026-10-16)

## 실행
- PR #166 ready(non-draft) head `4b30f72cac996eb076680214ca4d14b5b7db7e8d`.
- 사전 확인: PR checks ci 3건 SUCCESS, MERGEABLE/CLEAN. prior sync run `38843944675` success, ready run `38844392428` success.
- 머지: `gh pr merge 166 --merge --match-head-commit 4b30f72…`(squash·branch 삭제 없음) → **MERGED** 2026-10-16T03:15:36Z, merge SHA `9cd019015a680e0e57bdc1ac3b1df14bb368f074`.
- main CI: `gh workflow run ci.yml --ref main` → run [38844636878](https://github.com/qus0in/yoroi/actions/runs/38844636878), event `workflow_dispatch`, headSha `9cd0190…` = merge SHA, **success**.

## 상태
- origin/main = `9cd0190`(머지 커밋). 로컬 dev/HEAD = `4b30f72`(ff 동기화는 후속).
- 미실행: main 직접 push·tag·Release·global·레터. dev/ROOT user dirty5 보존.
- 다음: tag `v1.0.2`·Release → 전역 CLI 갱신(`/tmp/yoroi-102-update-global.sh`) → 레터 재발행 판단.
