# 프로젝트 목표

CLI MVP 계획은 [#1](https://github.com/qus0in/yoroi/issues/1)과 하위 #2–25다. 0.2.x 계획은 milestone #5–#8의
[#70](https://github.com/qus0in/yoroi/issues/70)–[#77](https://github.com/qus0in/yoroi/issues/77)이다(0.2.0 [#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76),
0.2.1 [#77](https://github.com/qus0in/yoroi/issues/77), 0.3.0 [#71](https://github.com/qus0in/yoroi/issues/71), 0.4.0 [#70](https://github.com/qus0in/yoroi/issues/70)). 옛 #30–#55·#69는 사용자 close(2026-10-10)다.
이슈별 상태와 근거는 [issue-status.md](issue-status.md)에 기록한다.

| 단계 | 목표 | 완료 기준 | 상태 |
| --- | --- | --- | --- |
| Bootstrap | 프로젝트 관리 기반 | 규칙·스킬·템플릿·검증·CI 정의 | 완료 |
| 원격 연결 | Git/GitHub 운영 적용 | 원격·라벨·보호·CI 확인 | 완료(main 보호, PR #28 병합 `48bdd8e`) |
| 제품 범위 | 5개 공급자 CLI once | 계약·사용량 창·오류 | 구현. #15–#17·#13·#14 closed, #29는 0.1.2(#4)에서 hold 유지(2026-10-10). watch는 0.3.0에서 제거([#83](https://github.com/qus0in/yoroi/issues/83)) |
| 개발 기반 | Node/TypeScript CLI | 실행·빌드·단위/BDD·CI | 완료. 샘플 red→green 기록(#3) 실측 후 close |
| 첫 기능 | 수집부터 CLI 표시 | 5개 어댑터·전체 계약 검증 | 구현 완료. Claude는 사용자 허가 GET으로 교체 |
| 자동화 | 워커·CI 범위·버전 스크립트·Wiki 운영 | #56–#61 | 완료. #57·#59·#60·#61·#25 closed(PR #62). #58·#56 closed(Wiki 게시 검증 후) |
| 웹·이력 | Zen Free 락·실사용 검증·캐시·인사이트 | [#70](https://github.com/qus0in/yoroi/issues/70)–[#77](https://github.com/qus0in/yoroi/issues/77) (0.2.0–0.4.0) | 0.2.0 PR 준비(#72–#76, 미발행), 0.2.1 검증 [#77], 0.3.0·0.4.0 plan/work. 옛 milestone #2·#30–#55·#69 close(사용자, 2026-10-10) |

- `package.json`의 버전은 `0.1.2`(발행 완료)이다. 버전 원본은 이 파일 하나이며 CLI `--version`도 이를 읽는다.
- [0.1.2 milestone](https://github.com/qus0in/yoroi/milestone/4): 계약 확인 #13·#14·#29(당시 open 3 유지).
  PR #66 병합 `4dfd4d7`(.env 병합 로드 `68bce2f` 포함), workflow_dispatch CI `37764517117` success,
  tag `v0.1.2`·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.2) 발행, milestone close.
  이후 #13·#14 close, #29만 open·hold 유지(사용자, 2026-10-10).
- [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1): CLI 5개 공급자 수집·표시·반복,
  pnpm 전환, 인증 검증 #1–#12·#18–#28과 자동화 #56–#61을 연결했다. v0.1.0으로 게시 완료.
- [0.1.1 milestone](https://github.com/qus0in/yoroi/milestone/3): 계약 확인 #13–#17·#29.
  #15–#17 close 후 close. 미실측 3건(#13·#14·#29)은 [0.1.2 milestone](https://github.com/qus0in/yoroi/milestone/4)으로 이동.
- [0.2.0 milestone](https://github.com/qus0in/yoroi/milestone/5): OpenCode Zen Free 한도 락
  [#72](https://github.com/qus0in/yoroi/issues/72)(plan)·[#73](https://github.com/qus0in/yoroi/issues/73)–[#76](https://github.com/qus0in/yoroi/issues/76)(work, 구현·리뷰 수정 완료, PR 준비·미발행).
  [#72](https://github.com/qus0in/yoroi/issues/72)는 0.2.0 PR에서 close 예정이다(아직 아님).
- [0.2.1 milestone](https://github.com/qus0in/yoroi/milestone/8): 0.2.0 실사용 검증·수정
  [#77](https://github.com/qus0in/yoroi/issues/77)(work, 실제 전역 설치·이벤트 관측).
- [0.3.0 milestone](https://github.com/qus0in/yoroi/milestone/6): SQLite·Keyv 60초 캐시와 관측 이력 [#71](https://github.com/qus0in/yoroi/issues/71)(plan).
  설계는 [v0.3.0-cache-history-design.md](v0.3.0-cache-history-design.md), 옛 초안은 [v0.2.0/cache-design.md](v0.2.0/cache-design.md).
- [0.4.0 milestone](https://github.com/qus0in/yoroi/milestone/7): AI 데이터 소스 5곳 인사이트 레터 [#70](https://github.com/qus0in/yoroi/issues/70)(work).
- 옛 milestone #2는 삭제, #30–#55·#69·#13·#14는 사용자 close(2026-10-10). [v0.2.0-plan.md](v0.2.0-plan.md)는 기록으로 남긴다.
- 첫 MVP 기능은 minor인 `0.1.0`으로 관리한다. 수정은 patch, 기능 추가는 minor로 증가한다.
  초기 `0.x`의 호환성 파괴는 minor와 마이그레이션 기록으로 관리한다.
  안정된 `1.x` 공개 계약 이후 호환성 파괴는 major다.
- minor 증가 시 patch를 0으로 초기화한다. 직전 발행은 `0.1.2`(milestone #4 close), 다음 후보는 `0.1.3`이다.
  기능 계획은 `0.2.0`–`0.4.0`([#70](https://github.com/qus0in/yoroi/issues/70)–[#77](https://github.com/qus0in/yoroi/issues/77))으로 분리했다.
- PR #67 병합(merge `62ef080`, 2026-10-08T13:16:52Z): 서브커맨드 도움말(`ff3371c`)·문서 정리(`3dadf92`) 반영 완료.
  PR CI `37780797515` success, main workflow_dispatch CI `37783139920` success.
- 현재 상태 요약: **0.2.0 PR 준비·미발행**([#72](https://github.com/qus0in/yoroi/issues/72)–[#76](https://github.com/qus0in/yoroi/issues/76) 구현·리뷰 완료),
  0.2.1 실사용 검증 [#77](https://github.com/qus0in/yoroi/issues/77), 0.3.0 [#71](https://github.com/qus0in/yoroi/issues/71)·0.4.0 [#70](https://github.com/qus0in/yoroi/issues/70) plan/work.
  [#29](https://github.com/qus0in/yoroi/issues/29)는 0.1.2(#4)에 open·hold 유지, #13·#14는 close(2026-10-10).
- 다음 후보: PR #67 변경을 담을 0.1.3 tag·Release 필요 여부는 사용자 결정(주의: opencode worker는 무료 모델 소진 시 구 패킷 재실행 주의).
- milestone은 릴리스 커밋의 원격 CI 확인 후 닫는다. 0.1.0·0.1.1·0.1.2는 close 완료. 이후 목표는 범위가 정해질 때 생성한다.
- `v0.1.0` tag·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행 완료(target `6a6802a`, PR #63 병합·PR CI `37725084420`).
  `v0.1.1` 발행 완료(target `7470250`, PR #65 병합·workflow_dispatch CI `37735089637`).
  `v0.1.2` 발행 완료(target `4dfd4d7`, PR #66 병합·workflow_dispatch CI `37764517117`).
  변경은 dev → main PR로 검증한다.
- Zen Free 락은 0.2.0([#72](https://github.com/qus0in/yoroi/issues/72)), 실사용 검증은 0.2.1([#77](https://github.com/qus0in/yoroi/issues/77)),
  로컬 캐시·관측 이력은 0.3.0([#71](https://github.com/qus0in/yoroi/issues/71)), 인사이트 레터는 0.4.0([#70](https://github.com/qus0in/yoroi/issues/70)) 범위다.
  외부 알림은 후속 범위다([#69](https://github.com/qus0in/yoroi/issues/69) close).
- milestone은 계획, `vX.Y.Z` tag는 검증된 커밋, Release는 발행 기록이다.
- 일반 절차는 `.agents/skills/semver-milestones/SKILL.md`를 따른다.
- 실행·인증 검증과 전환 기록은 [release-status.md](release-status.md)에 기록한다.
