# 프로젝트 목표

CLI MVP 계획은 [#1](https://github.com/qus0in/yoroi/issues/1)과 하위 #2–25다.
현재 로컬 구현·검증 결과는 [issue-status.md](issue-status.md)에 기록한다.

| 단계 | 목표 | 완료 기준 | 상태 |
| --- | --- | --- | --- |
| Bootstrap | 프로젝트 관리 기반 | 규칙·스킬·템플릿·검증·CI 정의 | 완료 |
| 원격 연결 | Git/GitHub 운영 적용 | 원격·라벨·보호·CI 확인 | 원격·라벨·main 보호 적용 |
| 제품 범위 | 5개 공급자 CLI once/watch | 계약·사용량 창·오류·60초 반복 | 조회 계약 확인, Ollama는 비공식 |
| 개발 기반 | Node/TypeScript CLI | 실행·빌드·단위/BDD·CI | 로컬 통과, 새 CI 원격 실행 미확인 |
| 첫 기능 | 수집부터 CLI 표시 | 5개 실제 어댑터 및 전체 계약 검증 | 구현·5개 계정 smoke 통과 |

- `package.json`의 버전은 `0.1.0`이다. 버전 원본은 이 파일 하나이며 CLI `--version`도 이를 읽는다.
- [0.1.0 milestone](https://github.com/qus0in/yoroi/milestone/1): CLI 5개 공급자 수집·표시·반복,
  pnpm 전환, 인증 검증 #1–27을 연결했다. 완료 기준은 milestone 설명에 기록했다.
- 첫 MVP 기능은 minor인 `0.1.0`으로 관리한다. 수정은 patch, 기능 추가는 minor로 증가한다.
  초기 `0.x`의 호환성 파괴는 minor와 마이그레이션 기록으로 관리한다.
  안정된 `1.x` 공개 계약 이후 호환성 파괴는 major다.
- minor 증가 시 patch를 0으로 초기화한다. 다음 수정 후보는 `0.1.1`, 새 기능 후보는 `0.2.0`이다.
- milestone은 릴리스 커밋의 원격 CI 확인 전까지 열린다. 이후 목표는 범위가 정해질 때 생성한다.
- 예정 tag는 `v0.1.0`. tag·Release는 생성하지 않았으며 변경은 dev → main PR로 검증한다.
- 웹 UI·DB/히스토리 저장·알림은 후속 범위다.
- milestone은 계획, `vX.Y.Z` tag는 검증된 커밋, Release는 발행 기록이다.
- 일반 절차는 `.agents/skills/semver-milestones/SKILL.md`를 따른다.
- 실행·인증 검증과 전환 기록은 [release-status.md](release-status.md)에 기록한다.
