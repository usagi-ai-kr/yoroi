# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 0.4.0 이전 과거 상세 기록과 이전 운영 상태는 [tasks-pre040.md](tasks-pre040.md) 및 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-11)

- 0.4.0 머지 완료(PR #91 `4744fbc`, main CI run 38125929202 success). 전역 CLI 0.4.0 갱신 완료. 외부 작업으로 [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0) 발행 관측.
- Milestone 10(0.4.0) 및 [#89](https://github.com/qus0in/yoroi/issues/89) open 유지: 실환경 `detect` 스모크 1회 미실행 상태이며 완료 기준 보존을 위해 분리하지 않고 유지.
- 0.5.0([#70](https://github.com/qus0in/yoroi/issues/70)) 미커밋 진행 중: 내부 stdout 레터 CLI 파이프라인 구현 및 인수인계 문서([docs/insights/handover.md](insights/handover.md)) 작성 완료. 전체 검증(pnpm check 592 tests, BDD 34 scenarios / 404 steps, build, validate-repo 398 files / 6 skills) 통과.
  8-A 실측 후 사용자 결정에 따라 0.5.0 검증 범위는 단일 호출 2소스(OpenRouter, Cognition 부분성공: accepted 1530 metric, rejected 20)로 정리를 완료함. Arena·AA는 4소스 코드 지원을 유지하며 후속 이슈([#92](https://github.com/qus0in/yoroi/issues/92), [#93](https://github.com/qus0in/yoroi/issues/93))로 분리함. 미커밋 변경 머지 및 코테츠 전달이 남아있어 #70은 open 유지.

## 남은 작업

- 0.4.0 스모크: 별도 사용자 승인 후 실환경 `yoroi detect --once` 1회 검증 및 #89·Milestone 10 close.
- 0.5.0: PR 머지 및 코테츠(Hermes) 인계 문서 전달 후 #70 정리.
- 후속 이슈: Arena 다중 페이지 수집([#92](https://github.com/qus0in/yoroi/issues/92)), AA 다중 페이지 수집([#93](https://github.com/qus0in/yoroi/issues/93)) — 마일스톤 없음.
- [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) 자연 발생 실관측 대기: Zen 무료 한도 초과/해제 및 로드 시각 확인.
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
- `0.4.0`: [#89](https://github.com/qus0in/yoroi/issues/89) 감지(PR #91 머지 완료, [v0.4.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.4.0) 발행 관측, 스모크 대기로 milestone 10 / #89 open 유지).
- `0.5.0`: [#70](https://github.com/qus0in/yoroi/issues/70) 인사이트 레터 (2소스 기준 검증 정리 완료, 머지/인계 대기로 open 유지).
- 후속: [#92](https://github.com/qus0in/yoroi/issues/92) (Arena), [#93](https://github.com/qus0in/yoroi/issues/93) (AA).
- `0.6.0`: [#84](https://github.com/qus0in/yoroi/issues/84) trend (0.5.0 완료 후 진행).
