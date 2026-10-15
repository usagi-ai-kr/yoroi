# 로컬 작업 기록 보관본 (2)

- `b0d74cf` 커밋(0.13.2 패치 준비)에서 파일 100줄 제한 유지를 위해 정리된 비중복 상세 이력 식별자를 원문 그대로 보관한다.
- 현재 운영 현황은 [tasks.md](tasks.md), 릴리스 상태는 [release-status.md](release-status.md)를 참조한다.

## 0.5.1 상세 발행 기록 (출처: docs/release-status.md b0d74cf^ 이관)

- PR [#98](https://github.com/qus0in/yoroi/pull/98) 병합 커밋 `2536baa69f88647a9ef75704bb4ee3729e248b11`(main).
- main CI [run 38141050373](https://github.com/qus0in/yoroi/actions/runs/38141050373) success.
- [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행 완료 (tag `v0.5.1`).
- 전역 CLI 0.5.1 동기화 완료 (`yoroi --version` 0.5.1 일치).
- OpenCode 플러그인 재설치 installed 완료 (운영 반영은 사용자 OpenCode 재시작 대기).
- [#92](https://github.com/qus0in/yoroi/issues/92)·[#93](https://github.com/qus0in/yoroi/issues/93)·[#96](https://github.com/qus0in/yoroi/issues/96)·[#97](https://github.com/qus0in/yoroi/issues/97) close 및 [Milestone 0.5.1](https://github.com/qus0in/yoroi/milestone/11) close 완료.
- 0.6.0 착수: [#94](https://github.com/qus0in/yoroi/issues/94) 레터 이슈 발행, [#84](https://github.com/qus0in/yoroi/issues/84) trend 착수.

## 0.8.3–0.8.5 상세 작업 기록 (출처: docs/tasks.md b0d74cf^ 이관)

### 0.8.3 발행 및 0.8.4 준비 (2026-10-13)

- v0.8.3 발행: PR #120 → main `81b264c`, PR CI 1회 성공, main CI 38332564117 attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.3), 전역 CLI 0.8.3.
- 실수집 status `all_healthy`로 Cognition 부분 수집 경고 해소; #116·#117 close 및 0.8.3 milestone close.
- 0.8.4: [#121](https://github.com/qus0in/yoroi/issues/121) Cursor 접근 표기 단순화, 구현 go1 진행 중; dev → main PR 준비.
- v0.8.4 발행: PR #122 → main `73f4ad1`, PR/main CI 38336083878 attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.4), 전역 CLI 0.8.4.
- #115 본문 갱신(2026-10-13 11:19:10 KST), #121·0.8.4 milestone close 완료.
- 0.8.5 준비: [#123](https://github.com/qus0in/yoroi/issues/123) 레터 정정 8건, dev → main PR.

### 0.8.5 발행 및 0.8.6 준비 (2026-10-13)

- v0.8.5 발행 완료: PR #124 → main `240378b`, PR/main CI [38344750752](https://github.com/qus0in/yoroi/actions/runs/38344750752) attempt 1 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.5), 전역 CLI 0.8.5.
- #115 본문 갱신(2026-10-13 13:07:28 KST), #123·0.8.5 milestone close 완료.
- 0.8.6 범위: [#125](https://github.com/qus0in/yoroi/issues/125) 레터 발행을 Hermes 크론에서 yoroi 자체 PM2로 이관하고 `insights publish` 명령 추가; dev → main PR 준비.
