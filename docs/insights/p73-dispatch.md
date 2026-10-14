# p73 분배: 0.10.0 PR 리뷰·머지·릴리스 (2026-10-14 사용자 승인 "버전 범프하여 릴리스까지", "제안대로 진행")

o(`w12:p13`)는 분배·진척만 맡는다. 최종 요약: `scratch/reports/yoroi-p73-release-010.md`(o 작성).

## 현재 상태 (o 확인)

- [PR #139](https://github.com/qus0in/yoroi/pull/139) dev → main, head `b7a2f75`, CI pass, MERGEABLE.
  dev = origin/main(`9b86ab4`) + 13커밋. 메신저 제안의 worktree·cherry-pick은 불필요(파편화가 이미 dev로 정리됨).
- 버전 가드 하드코딩 제거 `b7a2f75`(w2, p72 3단계). 940/940, typecheck·validate PASS.
- 마일스톤 `0.10.0`(#20) open, 열린 이슈 0. PR에 마일스톤 미연결.
- 구현 w2. 리뷰는 w4, 릴리스는 w3가 맡는다.

## A. w4 — PR 리뷰·머지

1. `gh pr diff 139`·커밋 목록으로 범위를 대조한다: 가중치 설정 외부화, 오케 사용량 차원·열, agy `c-5h` 라벨,
   분배 CLI, 매시간 사용량 보고, OpenCode V2 이전, 버전 가드 하드코딩 제거. `docs/roadmap.md` 0.10.0 절·마일스톤 설명과 어긋나면 보고.
2. 시크릿·개인 사용량 원본·`scratch/` 산출물이 diff에 없는지, 파일당 100줄(validate PASS)인지 확인.
3. PR에 마일스톤 `0.10.0` 연결, 본문에 마일스톤 링크·검증 결과가 없으면 추가(`gh pr edit`).
4. PASS이고 CI 통과면 `gh pr merge 139 --merge`(기존 머지 방식과 동일). FAIL이면 머지하지 않고 사유 보고.
5. 보고: PASS/FAIL, 머지 SHA. 리뷰 메모는 `scratch/reports/yoroi-p73-w4-review.md`.

## B. w3 — 릴리스 (A 머지 완료: PR #139 → main `245d538`, w4 PASS)

1. `gh workflow run ci.yml --ref main` 후 main CI 성공 확인(main push로는 CI가 돌지 않는다).
2. 머지 SHA에 tag `v0.10.0`·GitHub Release 발행(`semver-milestones` 스킬, 노트는 PR 범위 요약).
3. 마일스톤 `0.10.0` close(열린 이슈 0일 때만).
4. 전역 CLI 갱신: `global-cli-update` 스킬·docs/global-install.md 절차, `yoroi --version`이 0.10.0인지 확인.
   이 단계는 공유 작업 트리를 switch하지 않는다(필요하면 `/tmp` worktree, 끝나면 정리).
5. 보고: main CI run, tag, Release URL, 전역 CLI 버전.

## 공통 금지

main 직접 push, 모델·세션 변경, 실제 유료 API 호출, 시크릿 노출, 소유 밖 파일 수정, 공유 트리 `git switch`.
사용자 결정이 필요한 갈림길은 멈추고 보고한다.
