# 로컬 작업 기록 (현재 운영 현황)

- 원격이 없거나 외부 기록이 허가되지 않은 작업은 여기에 기록한다.
- 과거 상세 기록(2026-10-07 ~ 10-08 초기 구성·PR #28·#62·#63·#66·#67)은 [tasks-archive.md](tasks-archive.md)에 보관한다.
- main에 직접 push하지 않는다. 모든 변경은 dev → main PR로 병합한다.

## 현재 상태 (2026-10-10)

- milestone(2026-10-10 사용자 결정): #5 `0.2.0`([#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76)),
  #6 `0.3.0`([#71](https://github.com/qus0in/yoroi/issues/71)), #7 `0.4.0`([#70](https://github.com/qus0in/yoroi/issues/70)), #8 `0.2.1`([#77](https://github.com/qus0in/yoroi/issues/77) 0.2.0 실사용 검증·수정).
  옛 milestone #2는 삭제, #30–#55·#69는 사용자(qus0in)가 2026-10-10 close(재개 아님).
- #29는 0.1.2 milestone(#4, close)에 open·hold 유지. #13·#14는 2026-10-10 close.
- 0.2.0 구현·보강 완료(미커밋): `src/app/zen-*.ts`, `src/infra/sqlite/`, `src/ui/cli/zen-free.ts`,
  `tests/zen-*`·`tests/sqlite-*`, `features/zen-free.*`, `docs/contracts-opencode-zen-free.md`.
  `package.json` `0.2.0`(PR 준비). 실제 OpenCode 로드·한도 이벤트·전역 설치는 미실행.
- [#71](https://github.com/qus0in/yoroi/issues/71) 설계 문서 [v0.3.0-cache-history-design.md](v0.3.0-cache-history-design.md) 작성 완료(2026-10-10, p8). 구현·의존성 설치는 미시작.
- v0.1.2 발행 완료(PR #66 `4dfd4d7`, tag·Release, milestone #4 close). PR #67 `62ef080`(서브커맨드 도움말·문서 정리) merge.
  상세 CI·tag 기록은 [release-status.md](release-status.md)에 있다.
- 검증 수치(과거 루트 보고): TS 136 tests, BDD 25 시나리오/144 step, Python 19 tests, 스킬 테스트 PASS.

## 남은 작업

- [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) 수동 대기(close 안 함): Zen 무료 한도 초과가 자연 발생하면 `yoroi zen-free status`가 locked이고 로드 시각이 찍히는지, 다음 정상 응답 뒤 해제되는지 확인해 이슈에 기록한다.
- PR #86 후속(미착수): 토큰 갱신으로 이력 시리즈가 분리될 때(자격 증명에 사용자 id가 없는 경우)
  `n/a: no-previous`와 구분되는 "이력 끊김" 표시. 계정 다이제스트 값은 출력·로그에 싣지 않는다.
- PR #86 후속(미착수): 실환경 1회 검증 — macOS Keychain 계정 A→B 교체(TTL 이내), Linux 설정 경로 2종 불일치.
  실제 `.credentials.json`의 사용자 id 키 존재 여부(키 이름만)를 확인해 연속성 범위를 문서화한다.
- 0.2.0 PR: 커밋·tag·Release 없음(준비 단계). [#72](https://github.com/qus0in/yoroi/issues/72)는 0.2.0 PR에서 close 예정(아직 아님).
- [#70](https://github.com/qus0in/yoroi/issues/70)·[#71](https://github.com/qus0in/yoroi/issues/71) 문서 초안은 이번 0.2.0 PR에서 제외한다.
  0.2.1([#77](https://github.com/qus0in/yoroi/issues/77))에서 실제 전역 설치·이벤트 관측을 검증한다.
- [#71](https://github.com/qus0in/yoroi/issues/71) 구현과 [#72](https://github.com/qus0in/yoroi/issues/72) 전역 훅 설치는 별도 요청 시 진행. 0.1.3 tag·Release 여부도 사용자 결정.
- 그 외 추가 개발은 계획하지 않는다.

## 회고 (2026-10-08)

- 중단 요청 뒤 worker·후속 단계가 자동 재개되는 문제가 있었다 → `graceful-stop` 스킬 추가(재개 금지 체크포인트).
- root가 구현을 직접 맡아 부담이 커졌다 → root는 오케스트레이터, 구현·조사·검증은 패킷 분담([orchestration.md](orchestration.md)).
- opencode worker는 무료 모델 소진 시 오래된 패킷을 재실행할 수 있어 주의 필요.

## 0.2.0 준비 회고 (2026-10-10)

- 구현 worker와 검토 worker를 분리해 p2 리뷰 결함 15건 + 교차 리뷰 결함 2건을 머지 전에 수정했다.
- 검증 수치(worker 보고): `pnpm run check` 254 tests·BDD 32 통과. 커밋·tag·Release는 아직 없다.
- 실제 OpenCode 로드·한도 초과 이벤트·전역 설치(`~/.config/opencode/plugins/`)는 미실행이다.

## 소유표 (2026-10-10)

| pane | 모델 | 담당 | 상태 |
| --- | --- | --- | --- |
| p1 | Claude Opus 5.5 | root: 범위·패킷·감사·통합 | 사용 중 |
| p2 | Claude Sonnet 5.5 | worker | 사용 중 |
| p3 | Codex GPT-6.1-Sol | worker | 사용 중 |
| p4 | Codex GPT-6-Luna | worker | 사용 중 |
| p5 | OpenCode Zen Space Bunny Free | worker | 한도 초과 문구 시 제외 |
| p6 | OpenCode Go LongCat 2.5 Preview Free | worker | 사용 중 |
| p7 | OpenCode Go Step 5 Preview Free | worker | 사용 중 |
| p8 | Ollama Cloud DeepSeek V4.1 Flash | worker | #71 설계 문서 작성 |

- 같은 파일을 두 pane에 동시에 배정하지 않는다. 이전 구현 소유·병합 기록은 tasks-archive.md·issue-status.md에 있다.

## CI 정책

- CI job은 항상 실행된다. 변경이 문서뿐(`docs/**`, 루트 README·AGENTS·CLAUDE)이면 앱 install·check를 생략하는 fast pass로 필수 체크 `ci`를 통과시킨다.
- 코드·workflow·스킬 변경은 `validate-repo.py --ci`, 스킬·회귀 테스트, frozen install, 전체 check를 실행한다.
- 필수 체크 `ci`는 docs-only에서도 계속 요구하며 pending으로 남지 않아야 한다.
- 운영 skill(`.agents/skills/**`)은 제외 대상이 아니다. 스킬 변경은 full 경로다.

## 이슈·마일스톤 매핑

- `0.1.0`: #1–#12·#18–#28, #56–#61. v0.1.0 tag·Release 발행 완료.
- `0.1.1`: #13–#17·#29 → #15–#17 closed, milestone #3 closed, v0.1.1 발행.
  - 회고: `report_audit.py`는 glob 소유 패턴을 펼치지 않아 오탐 FAIL을 낸다. root가 `git status`로 대조한다.
- `0.1.2`: #13·#14·#29. milestone #4 closed, v0.1.2 발행. #13·#14는 2026-10-10 close, #29는 hold 유지.
- `0.2.0`: [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76)(PR 준비·미발행, #72 close 예정). `0.2.1`: [#77](https://github.com/qus0in/yoroi/issues/77)(work).
  `0.3.0`: [#71](https://github.com/qus0in/yoroi/issues/71)(plan). `0.4.0`: [#70](https://github.com/qus0in/yoroi/issues/70)(work).
  옛 #30–#55·#69·milestone #2는 사용자 종료(2026-10-10).
- 상세: [issue-status.md](issue-status.md).
