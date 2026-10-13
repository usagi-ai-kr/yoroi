# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 0.4.0 이전 과거 상세 기록과 이전 운영 상태는 [tasks-pre040.md](tasks-pre040.md) 및 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-12)

- 0.8.0: PR #109 머지(`a54af3e`), main CI 38232400154 success, [v0.8.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.0) 발행, 전역 CLI 0.8.0 태그 worktree 설치 완료.
- 0.8.0의 통합 Top10(#108)은 사용자 의도 오해로 [#111](https://github.com/qus0in/yoroi/issues/111)에서 오케스트레이터/워커 Top10 별도 유지(이중 자격 모델은 양쪽 표시)로 정정 중이다.
- [#110](https://github.com/qus0in/yoroi/issues/110) 레터는 통합 형식으로 발행됐으므로 #111 갱신본 반영 후 재발행 예정이다.
- 0.8.1 준비: #111 정정 + #110 갱신본 재발행을 묶어 dev → main PR 예정(package.json 0.8.1).
- #111 범위: 오케스트레이터·워커 Top10 별도 유지, 교집합은 `↔`; GPT 6.x 세대가 있으면 지표 무관 전체 접근 모델 기준으로 GPT 5.6 luna·terra·sol 제외.
- Kimi K3 참고 한도(2026-10-12): OpenCode Go Plus 440회/5h 추정([opencode.ai/go](https://opencode.ai/go)); Ollama Cloud Pro 크레딧 $60/월·토큰 차감·동시 3([ollama.com/pricing](https://ollama.com/pricing)).
- #107 재현 실패 기록: SQLite WAL 동시 오픈 테스트 400라운드, 실패 0회.
- 참고 순위 토큰값 퇴행 수정은 zen 진행 중.

- 0.4.0: #89 실환경 스모크 2026-10-11 19:17:56 KST 1회 exit 0 성공, zen:plugin-stale 1건 관측(#77 근거로 계속 관측), #89 및 0.4.0 milestone close 완료.
- 0.5.0: PR #95 머지(e34f217), main CI 38132032129 success, [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행, 전역 CLI 0.5.0 갱신, #70 close, 0.5.0 milestone close 완료.
- 0.5.1: PR #98 머지(2536baa), main CI 38141050373 success, [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행, 전역 CLI 0.5.1 동기화, OpenCode 플러그인 재설치 installed(재시작 대기), #92·#93·#96·#97 close, 0.5.1 milestone close 완료.
- 0.6.0: [#84](https://github.com/qus0in/yoroi/issues/84) trend(24h·7d 병행) 구현 완료. Top50 수집·Top10 압축 레터(`--full` 상세 유지). [#94](https://github.com/qus0in/yoroi/issues/94) 첫 수동 발행 [#99](https://github.com/qus0in/yoroi/issues/99), 크론 첫 자동 발행 [#100](https://github.com/qus0in/yoroi/issues/100), Top10 갱신본([#100](https://github.com/qus0in/yoroi/issues/100) 댓글 2026-10-12 10:31 KST) 반영 완료. 크론 `yoroi-letter-daily`·`yoroi-weekly-report` 가동. [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) 해제 실관측(2026-10-12 00:22Z) 확인.

- PR #101 머지(`ae7cd83`), main CI [38203425496](https://github.com/qus0in/yoroi/actions/runs/38203425496): attempt1은 `tests/cli-process.test.ts` 3000ms flaky 실패, attempt2 success. [v0.6.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.6.0) 발행 완료.
- 전역 CLI 0.6.0은 `v0.6.0` 태그 worktree에서 설치했다. #84·#77·#88 및 0.3.1 milestone close 완료. 0.6.0 milestone은 #94 크론 관측 대기로 open 유지.
- release-prep-070: 버전·준비 문서 갱신, 이력 보존 및 삭제 줄 감사 후 `pnpm run check`·레포 검증·diff 검사로 확인한다. 외부 호출·커밋 없이 로컬 기록만 수행한다.

## 남은 작업

- 0.6.0 milestone(9): #94 크론 관측 대기로 open 유지.
- 0.7.0 milestone: #102 OpenCode Data 내부 참조 수집(dailyTokens 파서·리더보드 키 진단), #103 순위 규칙, #104 요금제상 최적, #105 `--markdown`을 묶어 dev → main PR 준비.
- #102 크롤러 작업·진단 완료. 리더보드 파서는 내일 진단 결과 후 진행한다(승계 작업 없음).
- 크론 출력은 0.6.0부터 `--pretty` 압축 Top10, 0.7.0부터 `--markdown`이다.
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
- `0.5.1`: milestone 11 ([#92](https://github.com/qus0in/yoroi/issues/92)·[#93](https://github.com/qus0in/yoroi/issues/93) top20, [#96](https://github.com/qus0in/yoroi/issues/96) Zen 리셋/남은시간, [#97](https://github.com/qus0in/yoroi/issues/97) OpenCode 락 복구, PR #98 머지 2536baa, [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행 완료, #92·#93·#96·#97 close, milestone 11 close).
- `0.6.0`: milestone 9 ([#84](https://github.com/qus0in/yoroi/issues/84) trend 24h·7d 병행, Top50 수집·Top10 압축 레터, [#94](https://github.com/qus0in/yoroi/issues/94) 레터 #99·#100 발행 및 크론 2종 등록, [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) 해제 실관측으로 close 완료, #84 close, PR #101 머지 ae7cd83 및 v0.6.0 발행, milestone은 #94 크론 관측 대기로 open).
- `0.7.0`: #102·#103·#104·#105 milestone, 버전 0.7.0 및 dev → main PR 준비.

## 0.8.1 발행 및 0.8.2 준비 (2026-10-13)

- v0.8.1 발행: PR #112 → main `57b379d`, main CI 38247171932 attempt 2 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.1), 전역 CLI 0.8.1.
- 0.8.2 milestone: [#113](https://github.com/qus0in/yoroi/issues/113) 레터 종합 스코어 정렬·피드백 4건 + 재오픈 [#107](https://github.com/qus0in/yoroi/issues/107) SQLite WAL 첫 열기 재시도 수정. dev → main PR 준비 중.

## 0.8.2 발행 및 0.8.3 준비 (2026-10-13)

- v0.8.2 발행 완료: PR #114 → main `e631228`, PR/push CI 1회 성공, main CI 38324791859 attempt 1 success, [v0.8.2 Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.2), 전역 CLI 0.8.2 태그 worktree 설치.
- #113·#107 close 및 0.8.2 milestone close 완료.
- 0.8.3: [#116](https://github.com/qus0in/yoroi/issues/116) Antigravity 요금제 추가, `plan-catalog.ts` 구현 go1 진행 중; dev → main PR 준비 범위.
- 0.8.3 범위 확장: [#117](https://github.com/qus0in/yoroi/issues/117) Top10 10행 채움·Free 티어 섹션·표시 안내/이모지·Cursor 요금제·Cognition 1.1·AA FrontierCode 대비·Grok/Kimi 롤백을 추가한다.
