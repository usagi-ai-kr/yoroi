# Git/GitHub 운영

## 현재 상태

- 현재 작업 브랜치는 `dev`이며 `dev → main` PR로 게시한다.
- 원격: `origin` → `https://github.com/qus0in/yoroi.git`.
- 관리 라벨: `.github/labels.json` 9개를 원격에 적용 완료했다(기존 기본 라벨 10개는 사용자 지시로 삭제).
- 2026-10-08 main 보호 적용: PR 필수, 승인 0명, `ci` 필수·strict, 관리자 포함,
  force push·삭제 금지. 기존 성공 workflow의 실제 job 이름 `ci`를 확인했다.
- 자동 머지 옵션은 아직 적용하지 않았다. 아래 머지·브랜치 유지 항목은 운영 목표다.
- [PR #28](https://github.com/qus0in/yoroi/pull/28): dev → main 병합 완료(merge commit `48bdd8e`), feature 라벨·0.1.0 milestone.
- 이후 변경은 별도 PR로 진행한다. docs-only 변경은 CI fast pass로 앱 검증을 생략하며, 필수 체크 `ci`는 계속 요구한다.
- PR #62 병합(`1b3b027`): `Closes #25 #57 #59 #60 #61` 자동 종료 확인. Wiki(#58)는 아직 게시 전이다. 게시 뒤 같은 문서 PR에서 #58·#56을 직접 close한다.
- PR 필수 체크는 pull_request 실행·head SHA·PR 체크 상태를 함께 확인한다.
  workflow_dispatch 체크는 성공해도 PR 필수 체크로 평가되지 않는다.
  자동 실행 누락 시 PR 이벤트/승인 대기/활성 workflow를 확인하고 적격 이벤트 CI를 실행한다.

| 항목 | 운영 목표 |
| --- | --- |
| 안정 브랜치 | `main`, 직접 push·force push·삭제 금지 |
| 작업 브랜치 | `dev`, `dev` → `main` PR |
| 필수 체크 | `ci`, 최신 main 기준 통과 |
| 머지 | merge commit, 지원 시 자동 머지 |
| 리뷰 | 1인 운영 기준 필수 승인 0명, PR은 필수 |
| 브랜치 유지 | 머지 후 `dev` 유지 |

## 이슈 종료 규칙 (2026-10-08 사용자 지시)

- 처리된 issue는 반드시 close한다. 완료 기준 충족 시 PR에 `Closes #번호`를 넣거나 PR 밖에서 직접 close한다.
- 미완료 사유가 있으면 open 유지 후 사유 1–2줄을 남긴다. memo 이슈는 손대지 않는다.
- PR 머지 뒤에야 끝나는 작업은 PR Closes에 넣지 않고 완료 후 직접 close한다.

## 초기화

로컬 `git init -b main`은 적용 완료다.
2026-10-07 원격 푸시 요청에 따라 빈 원격에 최초 main을 게시하고 같은 커밋에서 dev를 만든다.
최초 게시 이후 변경은 dev → main PR로 반영한다.
자동 머지 설정과 실제 머지의 허가는 구분한다.

## 이슈와 PR

- 일반 절차: `.agents/skills/github-workflow/SKILL.md`.
- 라벨 정의: `.github/labels.json`. 기본 라벨 10개는 사용자 명시 지시로 정리 완료.
- 이슈 템플릿: 계획/작업용 `task.md`, 사람 조치용 `handle.md`.
- 현황 보고는 `report`, 대기 상태는 `hold`로 표시한다.
- 커밋 제목은 `<feature|fix|docs|chore>: <요약>`을 권장한다.
- PR 라벨은 `feature`, `fix`, `docs` 중 주된 변경 하나를 선택한다.
- PR에 결과·검증·관련 이슈·남은 항목을 적는다.

## 원격 설정

레포 설정 요청에서 대상·인증·기존 설정을 확인한 뒤
`.agents/skills/github-workflow/references/setup.md`를 사용한다.
실제 적용 후 원격 주소·보호 규칙·필수 체크·머지 옵션을 이 문서에 기록한다.
