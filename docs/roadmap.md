# 프로젝트 목표

CLI MVP 계획은 [#1](https://github.com/qus0in/yoroi/issues/1)과 하위 #2–25다. 0.2.x 계획은 milestone #5–#8의
[#70](https://github.com/qus0in/yoroi/issues/70)–[#77](https://github.com/qus0in/yoroi/issues/77)이다(0.2.0 [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76),
  0.3.1 [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88), 0.3.0 [#71](https://github.com/qus0in/yoroi/issues/71),
  0.4.0 [#89](https://github.com/qus0in/yoroi/issues/89) 감지, 0.5.0 [#70](https://github.com/qus0in/yoroi/issues/70) 인사이트, 0.6.0 [#84](https://github.com/qus0in/yoroi/issues/84) trend
  (2026-10-11 재번호: 인사이트는 0.4.0→0.5.0, 감지는 0.4.0, trend는 0.6.0)). 옛 #30–#55·#69는 사용자 close(2026-10-10)다.
이슈별 상태와 근거는 [issue-status.md](issue-status.md)에 기록한다.

| 단계 | 목표 | 완료 기준 | 상태 |
| --- | --- | --- | --- |
| Bootstrap | 프로젝트 관리 기반 | 규칙·스킬·템플릿·검증·CI 정의 | 완료 |
| 원격 연결 | Git/GitHub 운영 적용 | 원격·라벨·보호·CI 확인 | 완료(main 보호, PR #28 병합 `48bdd8e`) |
| 제품 범위 | 5개 공급자 CLI once | 계약·사용량 창·오류 | 구현. #15–#17·#13·#14 closed, #29는 0.1.2(#4)에서 hold 유지(2026-10-10). watch는 0.3.0에서 제거([#83](https://github.com/qus0in/yoroi/issues/83)) |
| 개발 기반 | Node/TypeScript CLI | 실행·빌드·단위/BDD·CI | 완료. 샘플 red→green 기록(#3) 실측 후 close |
| 첫 기능 | 수집부터 CLI 표시 | 5개 어댑터·전체 계약 검증 | 구현 완료. Claude는 사용자 허가 GET으로 교체 |
| 자동화 | 워커·CI 범위·버전 스크립트·Wiki 운영 | #56–#61 | 완료. #57·#59·#60·#61·#25 closed(PR #62). #58·#56 closed(Wiki 게시 검증 후) |
| 웹·이력 | Zen Free 락·실사용 검증·캐시·인사이트 | [#70](https://github.com/qus0in/yoroi/issues/70)–[#89](https://github.com/qus0in/yoroi/issues/89) (0.2.0–0.6.0) | 0.2.0·0.3.0 발행 완료(v0.3.0 `f12f55a`), 0.3.1 로드 표시 [#77](https://github.com/qus0in/yoroi/issues/77)·실관측 [#88](https://github.com/qus0in/yoroi/issues/88), 0.4.0 감지 [#89](https://github.com/qus0in/yoroi/issues/89) v0.4.0 발행(main `4744fbc`, 스모크 대기로 #89 open). 옛 milestone #2·#30–#55·#69 close(사용자, 2026-10-10) |

- `package.json`의 버전은 `0.8.3`(직전 발행 v0.8.2, main `e631228`, 0.8.3 dev → main PR 준비 중)이다. 버전 원본은 이 파일 하나이며 CLI `--version`도 이를 읽는다.
- [0.1.2 milestone](https://github.com/qus0in/yoroi/milestone/4): 계약 확인 #13·#14·#29(당시 open 3 유지).
  PR #66 병합 `4dfd4d7`(.env 병합 로드 `68bce2f` 포함), workflow_dispatch CI `37764517117` success,
  tag `v0.1.2`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.2) 발행, milestone close.
  이후 #13·#14 close, #29만 open·hold 유지(사용자, 2026-10-10).
- [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1): CLI 5개 공급자 수집·표시·반복,
  pnpm 전환, 인증 검증 #1–#12·#18–#28과 자동화 #56–#61을 연결했다. v0.1.0으로 게시 완료.
- [0.1.1 milestone](https://github.com/qus0in/yoroi/milestone/3): 계약 확인 #13–#17·#29.
  #15–#17 close 후 close. 미실측 3건(#13·#14·#29)은 [0.1.2 milestone](https://github.com/qus0in/yoroi/milestone/4)으로 이동.
- [0.2.0 milestone](https://github.com/qus0in/yoroi/milestone/5): OpenCode Zen Free 한도 락
  [#72](https://github.com/qus0in/yoroi/issues/72)(plan)·[#73](https://github.com/qus0in/yoroi/issues/73)–[#76](https://github.com/qus0in/yoroi/issues/76)(work). v0.2.0 Release 발행(2026-10-10), milestone close(6 closed).
- [0.3.1 milestone](https://github.com/qus0in/yoroi/milestone/8): Zen Free 로드 표시 패치 [#77](https://github.com/qus0in/yoroi/issues/77)·자연 발생 실관측 [#88](https://github.com/qus0in/yoroi/issues/88)
  (2026-10-11 사용자 결정: `0.2.1`에서 `0.3.1`로 이름 변경. v0.3.0이 이미 main에 있어 다음 patch를 0.3.1로 발행한다).
  [#77](https://github.com/qus0in/yoroi/issues/77)(work, 실제 전역 설치·이벤트 관측). #77·#88 및 0.3.1 milestone close 완료.
- [0.3.0 milestone](https://github.com/qus0in/yoroi/milestone/6): SQLite 60초 캐시와 관측 이력 [#71](https://github.com/qus0in/yoroi/issues/71)(Keyv 대신 `node:sqlite`, [#82](https://github.com/qus0in/yoroi/issues/82)). v0.3.0 발행(`f12f55a`, 2026-10-11).
  #71·[#83](https://github.com/qus0in/yoroi/issues/83) close는 별도 조치다. 설계는 [v0.3.0-cache-history-design.md](v0.3.0-cache-history-design.md), 옛 초안은 [v0.2.0/cache-design.md](v0.2.0/cache-design.md).
- [0.4.0 milestone](https://github.com/qus0in/yoroi/milestone/10): 내장 10분 주기 감지 [#89](https://github.com/qus0in/yoroi/issues/89)(plan). v0.4.0 Release 발행 완료(main `4744fbc`, PR #91), 실환경 detect 스모크 exit 0 성공 확인 후 #89 및 milestone close 완료.
  Zen Free 락·한도 초과/해제 관측과 공급자 usage 이상 감지를 다룬다(2026-10-11 재번호로 #10 신설).
- [0.5.0 milestone](https://github.com/qus0in/yoroi/milestone/7): AI 데이터 소스 5곳 인사이트 레터 [#70](https://github.com/qus0in/yoroi/issues/70)(work, 2026-10-11 재번호: `0.4.0`에서 `0.5.0`으로). PR #95 머지(`e34f217`), [v0.5.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.0) 발행 완료, #70 및 milestone close 완료. 계약은 [insights/execution-contract.md](insights/execution-contract.md).
- [0.5.1 milestone](https://github.com/qus0in/yoroi/milestone/11): Arena top20 [#92](https://github.com/qus0in/yoroi/issues/92), AA top20 [#93](https://github.com/qus0in/yoroi/issues/93), Zen Free 리셋/남은시간 [#96](https://github.com/qus0in/yoroi/issues/96), OpenCode 락 복구 [#97](https://github.com/qus0in/yoroi/issues/97) 구현, PR #98 머지(`2536baa`), [v0.5.1 Release](https://github.com/qus0in/yoroi/releases/tag/v0.5.1) 발행 완료, #92·#93·#96·#97 및 milestone close 완료 (#94는 0.6.0 이동).
- [0.6.0 milestone](https://github.com/qus0in/yoroi/milestone/9): Hermes 매일 전달/운영문서 [#94](https://github.com/qus0in/yoroi/issues/94)(수동 #99·크론 #100 발행 완료, Top50 수집·Top10 압축 레터, `--full` 상세 유지, 크론 yoroi-letter-daily·yoroi-weekly-report 등록), SQLite 사용량 이력 기반 추세 보기 [#84](https://github.com/qus0in/yoroi/issues/84)(24h·7d 병행 구현), Zen Free 해제 실관측(2026-10-12 00:22Z)으로 [#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88) close 완료. #84 close, v0.6.0 발행 완료, #94 크론 관측 대기로 milestone open 유지. (2026-10-11 재번호로 #9, #94는 사용자 결정으로 0.5.1에서 이동)
- 옛 milestone #2는 삭제, #30–#55·#69·#13·#14는 사용자 close(2026-10-10). [v0.2.0-plan.md](v0.2.0-plan.md)는 기록으로 남긴다.
- 첫 MVP 기능은 minor인 `0.1.0`으로 관리한다. 수정은 patch, 기능 추가는 minor로 증가한다.
  초기 `0.x`의 호환성 파괴는 minor와 마이그레이션 기록으로 관리한다.
  안정된 `1.x` 공개 계약 이후 호환성 파괴는 major다.
- minor 증가 시 patch를 0으로 초기화한다. 직전 발행은 `v0.6.0`(main `ae7cd83`), 다음 후보는 `0.7.0`이다.
  기능 계획은 `0.2.0`–`0.6.0`([#70](https://github.com/qus0in/yoroi/issues/70)–[#89](https://github.com/qus0in/yoroi/issues/89))으로 분리했다(2026-10-11 재번호).
- PR #67 병합(merge `62ef080`, 2026-10-08T13:16:52Z): 서브커맨드 도움말(`ff3371c`)·문서 정리(`3dadf92`) 반영 완료.
  PR CI `37780797515` success, main workflow_dispatch CI `37783139920` success.
- 현재 상태 요약: **v0.6.0 발행 완료**(PR #101 → `ae7cd83`, main CI 38203425496 attempt2 success). v0.5.1(tag → `2536baa`, main CI 38141050373)·0.5.0·0.4.0·0.3.0·0.2.0도 발행됐다.
  0.6.0 발행 범위([#84](https://github.com/qus0in/yoroi/issues/84) trend 24h·7d, [#94](https://github.com/qus0in/yoroi/issues/94) Hermes 레터 #99·#100, 크론 2종 등록, Top50/Top10, #77·#88 해제 실관측 반영).
  [#29](https://github.com/qus0in/yoroi/issues/29) open·hold 유지.
- 다음 후보: PR #67 변경을 담을 0.1.3 tag·Release 필요 여부는 사용자 결정(주의: opencode worker는 무료 모델 소진 시 구 패킷 재실행 주의).
- milestone은 릴리스 커밋의 원격 CI 확인 후 닫는다. 0.1.0·0.1.1·0.1.2는 close 완료. 이후 목표는 범위가 정해질 때 생성한다.
- `v0.1.0` tag·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행 완료(target `6a6802a`, PR #63 병합·PR CI `37725084420`).
  `v0.1.1` 발행 완료(target `7470250`, PR #65 병합·workflow_dispatch CI `37735089637`).
  `v0.1.2` 발행 완료(target `4dfd4d7`, PR #66 병합·workflow_dispatch CI `37764517117`).
  변경은 dev → main PR로 검증한다.
- Zen Free 락은 0.2.0([#72](https://github.com/qus0in/yoroi/issues/72)), 로드 표시·실관측은 0.3.1([#77](https://github.com/qus0in/yoroi/issues/77)·[#88](https://github.com/qus0in/yoroi/issues/88)),
  로컬 캐시·관측 이력은 0.3.0([#71](https://github.com/qus0in/yoroi/issues/71)), 인사이트 레터는 0.5.0([#70](https://github.com/qus0in/yoroi/issues/70)) 범위다,
  감지는 0.4.0([#89](https://github.com/qus0in/yoroi/issues/89)), trend는 0.6.0([#84](https://github.com/qus0in/yoroi/issues/84))이다(2026-10-11 재번호).
  외부 알림은 후속 범위다([#69](https://github.com/qus0in/yoroi/issues/69) close).
- milestone은 계획, `vX.Y.Z` tag는 검증된 커밋, Release는 발행 기록이다.
- 일반 절차는 `.agents/skills/semver-milestones/SKILL.md`를 따른다.
- 실행·인증 검증과 전환 기록은 [release-status.md](release-status.md)에 기록한다.

- PR #101 머지(`ae7cd83`), main CI [38203425496](https://github.com/qus0in/yoroi/actions/runs/38203425496): attempt1은 `tests/cli-process.test.ts` 3000ms flaky 실패, attempt2 success. [v0.6.0 Release](https://github.com/qus0in/yoroi/releases/tag/v0.6.0) 발행 완료.
- 전역 CLI 0.6.0은 `v0.6.0` 태그 worktree에서 설치했다. #84·#77·#88 및 0.3.1 milestone close 완료. 0.6.0 milestone은 #94 크론 관측 대기로 open 유지.
- 0.7.0 milestone: #102 OpenCode Data 내부 참조 수집(dailyTokens 파서·리더보드 키 진단), #103 순위 규칙, #104 요금제상 최적, #105 `--markdown`을 묶어 dev → main PR 준비.
- #102 크롤러 작업·진단 완료. 리더보드 파서는 내일 진단 결과 후 진행한다(승계 작업 없음).
- 크론 출력은 0.6.0부터 `--pretty` 압축 Top10, 0.7.0부터 `--markdown`이다.
- v0.7.0 발행(PR #106 → `025d16a`, main CI 38217518529 success). 0.8.0 milestone: [#108](https://github.com/qus0in/yoroi/issues/108) 통합 Top10(요금제 접근 모델만·역할 표시·DeepSeek 4.1 Flash 후속 모델 하한).
- v0.8.0 발행(PR #109 → `a54af3e`, main CI 38232400154 success, Release https://github.com/qus0in/yoroi/releases/tag/v0.8.0, 전역 CLI 0.8.0 태그 worktree 설치). 0.8.1 milestone: [#111](https://github.com/qus0in/yoroi/issues/111) 통합 Top10 표시를 오케스트레이터/워커 Top10 별도 유지(이중 자격 모델 양쪽 표시)로 정정, [#110](https://github.com/qus0in/yoroi/issues/110) 레터 갱신본 재발행.
- v0.8.1 발행(PR #112 → main `57b379d`, main CI 38247171932 attempt 2 success, [Release](https://github.com/qus0in/yoroi/releases/tag/v0.8.1), 전역 CLI 0.8.1).
- 0.8.2 milestone: [#113](https://github.com/qus0in/yoroi/issues/113) 레터 종합 스코어 정렬·피드백 4건 및 재오픈 [#107](https://github.com/qus0in/yoroi/issues/107) SQLite WAL 첫 열기 재시도 수정; dev → main PR 준비 중.
- 0.8.3 milestone scope: [#116](https://github.com/qus0in/yoroi/issues/116) Antigravity 요금제와 [#117](https://github.com/qus0in/yoroi/issues/117) Top10 채움·Free 티어 섹션·표시 안내/이모지·Cursor·Cognition 1.1·AA FrontierCode 대비·Grok/Kimi 롤백을 묶어 dev → main PR 준비.
