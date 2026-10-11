# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 0.4.0 이전 과거 상세 기록과 이전 운영 상태는 [tasks-pre040.md](tasks-pre040.md) 및 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-11)

- 0.4.0: #89 실환경 스모크 2026-10-11 19:17:56 KST 1회 exit 0 성공, zen:plugin-stale 1건 관측(#77 근거로 계속 관측), #89 및 0.4.0 milestone close 완료.
- 0.5.0: PR #95 머지(e34f217), main CI 38132032129 success, [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행, 전역 CLI 0.5.0 갱신, #70 close, 0.5.0 milestone close 완료.
- 0.5.1: 마감 준비 (#92 Arena top20 다중페이지, [#93](https://github.com/qus0in/yoroi/issues/93) AA top20 다중페이지, [#96](https://github.com/qus0in/yoroi/issues/96) Zen Free 리셋/남은시간, [#97](https://github.com/qus0in/yoroi/issues/97) OpenCode 락 복구 구현 완료, [#94](https://github.com/qus0in/yoroi/issues/94)는 0.6.0 이동).

## 남은 작업

- 0.5.1: dev → main PR 생성, CI 통과 확인 및 릴리스.
- 0.6.0 milestone(9): [#94](https://github.com/qus0in/yoroi/issues/94)(Hermes 전달/운영문서) 및 [#84](https://github.com/qus0in/yoroi/issues/84)(trend) 진행.
- [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) 자연 발생 실관측 대기(locked/clear 전이 및 로드 시각 확인 유지).
- [#29](https://github.com/qus0in/yoroi/issues/29): 0.1.2 milestone(#4)에 open·hold 유지.
- PR #86 후속(미착수): 토큰 갱신 이력 끊김(`n/a: no-previous`와 구분) 표시. 계정 다이제스트 값은 출력·로그에 미노출.

## 소유표 (2026-10-11 패널 재편 현황)

| pane | 모델 | 역할 및 담당 | 상태 |
| --- | --- | --- | --- |
| w12:p1 | Codex GPT-6.1-Sol medium | root 오케스트레이터: 범위·패킷·감사·통합 | 가동 중 |
| w12:pG | Gemini 3.8 Flash medium (agy) | docs / 문서 패킷 및 아카이브 관리 담당 | 가동 중 |
| w12:p5 | DeepSeek V4.1 Flash Ollama Cloud max | worker: 0.5 CLI 구현 및 검증 담당 | 패킷 완료·종료 |
| w12:pJ | Step 5 Preview Free OpenCode Go high | worker: version / handover / 계약 점검 담당 | 패킷 완료·종료 |
| w12:pK | LongCat 2.5 Preview Free OpenCode Go high | worker: 독립 검토 및 비교 감사 담당 | 패킷 완료·종료 |
| w12:pF | 셸 | 에이전트 없음 (수동 확인 전용) | 유휴 |

- 같은 파일을 두 pane에 동시에 배정하지 않는다. 이전 구현 소유·병합 기록은 tasks-pre040.md·tasks-archive.md·issue-status.md에 있다.

## 이슈·마일스톤 매핑

- `0.1.0`–`0.1.2`: v0.1.0·v0.1.1·v0.1.2 발행 완료 (milestone close, #29 hold).
- `0.2.0`: [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76) 검증 후 [v0.2.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.2.0) 발행 완료.
- `0.3.0`: [#71](https://github.com/qus0in/yoroi/issues/71) 반영, [v0.3.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.0) 발행 완료 (`f12f55a`).
- `0.3.1`: [#77](https://github.com/qus0in/yoroi/issues/77) 로드 표시, [v0.3.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.3.1) 발행 완료 (`56413de`).
- `0.4.0`: [#89](https://github.com/qus0in/yoroi/issues/89) 감지 (스모크 exit 0 확인, #89 close, milestone 10 close, [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0) 발행 완료).
- `0.5.0`: [#70](https://github.com/qus0in/yoroi/issues/70) 인사이트 레터 (PR #95 머지 e34f217, [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행, 전역 CLI 갱신, #70 close, milestone 7 close).
- `0.5.1`: milestone 11 ([#92](https://github.com/qus0in/yoroi/issues/92) Arena top20, [#93](https://github.com/qus0in/yoroi/issues/93) AA top20, [#96](https://github.com/qus0in/yoroi/issues/96) Zen 리셋/남은시간, [#97](https://github.com/qus0in/yoroi/issues/97) OpenCode 락 복구 구현 완료).
- `0.6.0`: milestone 9 ([#94](https://github.com/qus0in/yoroi/issues/94) Hermes 전달/운영문서, [#84](https://github.com/qus0in/yoroi/issues/84) trend).
