# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 과거 기록(2026-10-07 ~ 10-08 초기 구성·PR #28)은 [tasks-archive.md](tasks-archive.md)에 보관한다.
- 직접 push 금지: main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-08)

- PR #28 병합 완료: merge commit `48bdd8e`, 작업 브랜치 `dev` 유지.
- 현재 워킹트리의 자동화 변경은 아직 커밋·PR되지 않았다(중간 상태, pending).
- 완료 확인: B2(SKILL 자기신고 한계, root git diff 대조 명시), development.md CI 정정, CI unittest `test_*.py` 확장, 버전 스크립트 테스트 9건.
- 진행 중: pretty CLI(p2, 타입·allowlist·watch 중지 테스트 정정). freeze 전이므로 pending.
- 세션 핸드오프: `docs/session-handoff.md`는 이 시점에 저장소에 없다. 작성되면 링크를 추가한다.
- 이슈: #22 close(사용자 승인 GET 계약 기준). #56(plan), #57(code/CI), #58(Wiki), #59(pretty CLI), #60(마스코트), #61(버전 스크립트)은 open.
- #61은 manifest 0.1.0 유지, 자동 태그·Release 없음. 검증 후 후속 PR에 `Closes #61`로 포함한다.
- #3·#13–#17·#25·#29는 미완료 사유가 있어 open 유지. 일괄 종료 없음. memo 이슈는 수정하지 않는다.

## 소유표 (중간 상태)

| 영역 | 소유 | 현재 상태 |
| --- | --- | --- |
| workflow `ci.yml`, agent-coordination 스킬 | p2 | B2 해소(자기신고 한계, root의 git diff 대조 명시). CI unittest `test_*.py` 확장 |
| pretty CLI (`--pretty`, 의존성, 테스트) | p2 | 진행 중. 타입·architecture allowlist·watch 중지 테스트 정정 중. 미freeze |
| CI classifier `scripts/ci-scope.py`, `validate-repo.py --ci`, `test_ci_scope.py`, `docs/development.md` CI 문장 | p3 | freeze(`/tmp/yoroi-ci-scope-result.md`). development.md 정정 완료 |
| 버전 스크립트 `scripts/version.py`, `test_version.py`, `docs/versioning.md` | p3 | 검증 9 tests PASS(`/tmp/yoroi-version-result.md`). #61 후속 PR에 포함 |
| Wiki 초안 (`docs/wiki*`) | p4 | 초안. 자동화 병합 후 마지막 게시(#58) |
| issue·docs 운영 현황, 독립 검토 | p5 | 본 문서 포함 docs 소유, 검토 `/tmp/yoroi-final-review.md` |
| README 마스코트(#60), 통합, 커밋·push·PR·merge | root | 사용자 요청 범위. 아직 미착수 또는 미커밋 |

## CI 제외 해석 (정책)

- CI는 항상 실행된다. 변경이 설명문서(`docs/**`, 루트 README·AGENTS·CLAUDE)뿐이면 앱 install·check를 생략한다.
- docs-only는 Fast pass로 앱 검증을 모두 생략한다. 사용자 명시 문서 CI 제외 요청에 따른 의도적 정책이다(root 판단).
- 코드·workflow·스킬 변경은 `validate-repo.py --ci`와 전체 검증을 유지한다.
- `docs/development.md`의 CI 설명은 이 실제 동작과 맞게 p3가 정정 중이다.
- 필수 체크 `ci`는 docs-only에서도 계속 요구한다. pending으로 남지 않아야 한다.
- 운영 skill(`.agents/skills/**`)은 제외 대상이 아니다. 스킬 변경은 full 경로다.
- 워커 운용은 사용자 요청을 존중한다. 임의로 자동 확장하지 않는다.

## 최종 검증 계획

1. 중간 상태는 pending으로 둔다. B2 수정과 development.md 정정 확인 전에는 PR을 열지 않는다.
2. 하나의 PR(dev → main)에 `Closes #57`, `Closes #59`, `Closes #60`, `Closes #25`를 넣는다. 병합 전 pull_request CI가 success여야 한다.
3. Wiki(#58) 게시 후 #58과 #56을 직접 close한다. Wiki는 머지 뒤 작업이므로 PR Closes에 넣지 않는다.
4. 병합 뒤 docs-only 기록 PR로 ci fast-pass가 원격에서 통과하는지 확인하고 결과를 이 문서에 기록한다.

## 완료 기준

- B2 수정 확인, development.md 정정 확인 후 리뷰 갱신. 로컬 `validate-repo.py`·`--ci`·테스트 10개·스킬 테스트 통과.
- 최종 PR 병합, pull_request CI success.
- 최종 PR 병합 후 #57·#59·#60·#25 close(PR Closes).
- docs-only fast-pass 원격 검증 기록 후 Wiki 게시(#58)와 #56 close.

## 이슈 종료·마일스톤 매핑 (2026-10-08)

- 완료 기준을 충족한 #1·#2·#4–#12·#18–#21·#22·#23·#24를 근거 댓글과 함께 close했다.
- #30–#55는 0.2.0, #1–#29·#56–#60은 0.1.0 milestone이다. 제품 버전은 0.1.0을 유지한다.
- 상세: [issue-status.md](issue-status.md).
