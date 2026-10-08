# 프로젝트 목표

CLI MVP 계획은 [#1](https://github.com/qus0in/yoroi/issues/1)과 하위 #2–25다. 웹·이력 계획은 [#30](https://github.com/qus0in/yoroi/issues/30)과 하위 #31–55(0.2.0)다.
이슈별 상태와 근거는 [issue-status.md](issue-status.md)에 기록한다.

| 단계 | 목표 | 완료 기준 | 상태 |
| --- | --- | --- | --- |
| Bootstrap | 프로젝트 관리 기반 | 규칙·스킬·템플릿·검증·CI 정의 | 완료 |
| 원격 연결 | Git/GitHub 운영 적용 | 원격·라벨·보호·CI 확인 | 완료(main 보호, PR #28 병합 `48bdd8e`) |
| 제품 범위 | 5개 공급자 CLI once/watch | 계약·사용량 창·오류·60초 반복 | 구현. 계약 일부(#13–#17·#29)는 0.1.1로 이동 |
| 개발 기반 | Node/TypeScript CLI | 실행·빌드·단위/BDD·CI | 완료. 샘플 red→green 기록(#3) 실측 후 close |
| 첫 기능 | 수집부터 CLI 표시 | 5개 어댑터·전체 계약 검증 | 구현 완료. Claude는 사용자 허가 GET으로 교체 |
| 자동화 | 워커·CI 범위·버전 스크립트·Wiki 운영 | #56–#61 | 완료. #57·#59·#60·#61·#25 closed(PR #62). #58·#56 closed(Wiki 게시 검증 후) |
| 웹·이력 | 대시보드·SQLite·운영 | #30–#55 (0.2.0) | 미구현 |

- `package.json`의 버전은 `0.1.0`이다. 버전 원본은 이 파일 하나이며 CLI `--version`도 이를 읽는다.
- [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1): CLI 5개 공급자 수집·표시·반복,
  pnpm 전환, 인증 검증 #1–#12·#18–#28과 자동화 #56–#61을 연결했다. 패키지 버전은 0.1.0을 유지한다.
- [0.1.1 milestone](https://github.com/qus0in/yoroi/milestone/3): 계약 확인 #13–#17·#29.
  0.1.0에서 이동한 사용자 결정 사항이다.
- [0.2.0 milestone](https://github.com/qus0in/yoroi/milestone/2): 웹·SQLite·운영 확장 #30–55. 아직 구현하지 않았다.
- 첫 MVP 기능은 minor인 `0.1.0`으로 관리한다. 수정은 patch, 기능 추가는 minor로 증가한다.
  초기 `0.x`의 호환성 파괴는 minor와 마이그레이션 기록으로 관리한다.
  안정된 `1.x` 공개 계약 이후 호환성 파괴는 major다.
- minor 증가 시 patch를 0으로 초기화한다. 다음 수정 후보는 `0.1.1`(milestone #3), 새 기능 후보는 `0.2.0`이다.
- milestone은 릴리스 커밋의 원격 CI 확인 후 닫는다. 0.1.0은 close 완료(31 closed, open 0). 이후 목표는 범위가 정해질 때 생성한다.
- `v0.1.0` tag·[Release](https://github.com/qus0in/yoroi/releases/tag/v0.1.0) 발행 완료(target `6a6802a`, PR #63 병합·PR CI `37725084420`).
  변경은 dev → main PR로 검증한다.
- 웹 UI·DB/히스토리 저장은 0.2.0 범위다. 알림은 후속 범위다.
- milestone은 계획, `vX.Y.Z` tag는 검증된 커밋, Release는 발행 기록이다.
- 일반 절차는 `.agents/skills/semver-milestones/SKILL.md`를 따른다.
- 실행·인증 검증과 전환 기록은 [release-status.md](release-status.md)에 기록한다.
