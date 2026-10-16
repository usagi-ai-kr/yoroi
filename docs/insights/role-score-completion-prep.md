# yoroi 1.0.2 발행 완료 문서 준비

- 범위: 발행 완료 기록 준비만. 이 문서는 발행 완료를 선언하지 않는다.
- 패킷 기준선: dev `4b30f72`; source 검증 unit 1042, BDD 45 / 632 steps, validate 680, preview 3562자. 모두 발행 전 로컬 증거다.
- 현재 main CI, tag, GitHub Release, 전역 CLI 갱신은 미실행이다. 병합 SHA·CI run·Release URL·시각은 확인 전 기입하지 않는다.
- 기존 상태 문서는 PR 초안 `c9fde22` 및 clean unit 1041·validate 672/673 기록을 포함한다. 이는 과거 스냅샷으로 보존하며 현재 head·최종 CI로 재사용하지 않는다.
- 1.1 원본 dirty5를 발행 후보에 넣지 않는다: `src/insights/letter-top10-score.ts`, `docs/insights/four-source-score.md`, `docs/orchestration.md`, `docs/insights/orchestration-takeover-20261015.md`, `tests/insights-worker-effort-source.test.ts`.
- 검토한 R 이력 네 문서(`orchestrator-value-restoration`, `orchestrator-weight-study`, `orchestrator-weight-baseline`, `orchestrator-weight-comparison`)는 과거 실험을 표시하고 현재 정책을 링크한다. 발행 후에도 역사 수치·출처를 덮어쓰지 않는다.
- #163/#164는 등록만이며 open 유지. #160/#162 레터는 수정·재발행하지 않는다. 새 milestone이나 PR `Closes`를 추가하지 않는다.

## 발행 뒤 사실로 갱신할 항목
- PR #166의 실제 병합 SHA와 병합 일자.
- 해당 SHA를 대상으로 한 main `workflow_dispatch` CI run URL/ID와 success 결과.
- `v1.0.2` tag 대상 SHA, Release 제목 `yoroi 1.0.2`, URL 및 publishedAt.
- 전역 CLI 갱신 후 `yoroi --version`과 `update:global --check` 결과. 비밀값·사용량 원본은 기록하지 않는다.
- 위 근거가 모두 확인된 뒤 `docs/release-status.md`와 `docs/tasks.md`만 담은 doc-only PR을 준비한다.

## 확인한 기준 문서
- `docs/insights/orchestrator-r-release-task.md`, `docs/release-status.md`, `docs/tasks.md`.
- 위 네 R 이력 문서 및 release prep / release notes / CI preflight 기록.
- 세부 체크박스와 변경 문안은 `/tmp/yoroi-102-completion-checklist.md`.
