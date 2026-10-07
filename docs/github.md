# Git/GitHub 운영

## 현재 상태

- 권한 조정 후 로컬 Git을 `main` 브랜치로 초기화했다.
- 원격: `origin` → `https://github.com/qus0in/yoroi.git`.
- 브랜치 보호·관리 라벨·자동 머지 옵션은 아직 적용하지 않았다.
- 아래는 운영 목표이며 원격에 적용된 설정을 의미하지 않는다.

| 항목 | 운영 목표 |
| --- | --- |
| 안정 브랜치 | `main`, 직접 push·force push·삭제 금지 |
| 작업 브랜치 | `dev`, `dev` → `main` PR |
| 필수 체크 | `ci`, 최신 main 기준 통과 |
| 머지 | merge commit, 지원 시 자동 머지 |
| 리뷰 | 1인 운영 기준 필수 승인 0명, PR은 필수 |
| 브랜치 유지 | 머지 후 `dev` 유지 |

## 초기화

로컬 `git init -b main`은 적용 완료다.
2026-10-07 원격 푸시 요청에 따라 빈 원격에 최초 main을 게시하고 같은 커밋에서 dev를 만든다.
최초 게시 이후 변경은 dev → main PR로 반영한다.
자동 머지 설정과 실제 머지의 허가는 구분한다.

## 이슈와 PR

- 일반 절차: `.agents/skills/github-workflow/SKILL.md`.
- 라벨 정의: `.github/labels.json`. 기존 라벨을 삭제하지 않는다.
- 이슈 템플릿: 계획/작업용 `task.md`, 사람 조치용 `handle.md`.
- 현황 보고는 `report`, 대기 상태는 `hold`로 표시한다.
- 커밋 제목은 `<feature|fix|docs|chore>: <요약>`을 권장한다.
- PR 라벨은 `feature`, `fix`, `docs` 중 주된 변경 하나를 선택한다.
- PR에 결과·검증·관련 이슈·남은 항목을 적는다.

## 원격 설정

레포 설정 요청에서 대상·인증·기존 설정을 확인한 뒤
`.agents/skills/github-workflow/references/setup.md`를 사용한다.
실제 적용 후 원격 주소·보호 규칙·필수 체크·머지 옵션을 이 문서에 기록한다.
