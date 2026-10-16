# yoroi 1.0.2 전역 갱신 스크립트 리뷰

- 범위: `docs/global-install.md`, `global-cli-update` 스킬, 소유된 `/tmp/yoroi-102-update-global.sh`의 독립 안전·정확성 리뷰.
- 실제 전역 설치, 실제 `.env` 읽기, 실제 pnpm/GitHub/API 호출, tag·Release는 수행하지 않았다. PR 소스·tests·다른 docs·README·Git은 변경하지 않았다.

## 발견과 수정

- 기존 EXIT trap은 stage만 정리했다. 갱신이 설치 `.env`를 제거한 뒤 실패하면 0600 백업은 남아도 설치 경로에는 `.env`가 없었다.
- 기존 스크립트는 임시 stage 경로를 stdout에 냈고 archive/설치 버전과 dist 가드를 출력만 해 실패를 차단하지 않았다.
- 새 trap은 성공·실패 종료 모두 `.env`가 없을 때 같은 설치 경로의 고유 임시 파일로 0600 원자 복원한다. 실패 시 백업을 보존하고, 성공 시에만 백업을 정리한다. 사전 `.env`가 없으면 백업 파일을 만들지 않는다.
- archive와 설치 패키지 버전을 1.0.2로 assert한다. 설치 dist를 archive에서 만든 dist와 비교하고 R 가격 입력·70/5/10/15 가중치·normalRankScores 존재 및 1.1 `aaFallback` 부재를 assert한다.
- 오류 출력은 고정 문구로 제한하고 stage·설치·환경 경로를 출력하지 않는다.

## 검증

- `bash -n /tmp/yoroi-102-update-global.sh` 통과, 84줄.
- mock Git archive, 고정 임시 `PNPM_STORE_DIR`의 mock pnpm, mock yoroi, 합성 패키지·합성 `.env`만 사용했다.
- 성공 경로: exit 0, archive/설치 1.0.2, dist 일치 및 R/normal/fallback 가드 통과, `.env` 0600 복원, 백업·stage 정리, 경로 출력 없음.
- 설치 실패 경로: updater가 합성 `.env`를 지운 뒤 exit 9. EXIT trap이 `.env`를 0600으로 복원하고 백업은 보존했으며 stage를 정리했다. 경로 출력 없음.
- 변경 전 같은 실패를 재현했을 때 백업만 남고 설치 `.env`가 사라졌으며 stage 경로가 출력됐다.

## 실행 게이트

- 스크립트는 아직 실행하지 않는다. 실행 승인은 main CI 성공과 tag/Release 확인 뒤 별도 작업에서 처리한다.
- 입력 SHA는 그 시점의 main CI 성공 병합 SHA여야 한다. 이번 작업은 Git/원격/환경 설정을 변경하지 않았다.
