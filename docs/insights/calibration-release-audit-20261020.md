# #180 Free 티어 캘리브레이션 및 PR #191 반영 점검 (2026-10-20)

- 점검 대상: 이슈 #180, PR #191, HEAD `e3abe25`, 원격 `origin/dev` `5532dac`.
- 원칙: 재구현·실모델 호출·자동 push/머지/close 금지. 사실 대조 및 한계 분리.

## 1. 이슈 #180 완료 항목 대조

1. 과제 세트 v1 및 결정론적 채점기 (`a83f737`):
   - 마이크로 과제 4종 fixture 고정, 루브릭(40/25/15/10/5/5), 컷오프(80/60) 구현.
2. 격리 샌드박스·어댑터·체커 (`c696e87`, `b42fcfd`):
   - 파일 화이트리스트 격리, artifact 기반 체커, 환각 실측, 과제별 오류 격리.
3. SQLite 이력 저장소 (`92ad570`):
   - v7 마이그레이션 `calibration_runs`, 보존 상한 20, 필드 화이트리스트 검증.
4. 명시적 opt-in CLI (`34ab02e`, `b08ca1a`, `b61f105`):
   - `insights calibrate free --model <id>`, 쿼터 불명·적용 수준 고지, `--yes` 필수.
5. 레터 댓글 3 Free 표 작업 가능성 열 (`ab00347`):
   - 7열 작업 가능성(capable/auxiliary/not_recommended/provisional/unverified) 반영.

## 2. 알려진 한계 및 후속 과제 (비차단)

- 네트워크 및 깊은 git 차단은 OS 레벨 강제가 아닌 힌트·탐지-플래그 수준임.
  중대 위반 시 점수와 무관하게 verdict fail-closed(무효) 판정으로 방어.
- task-2는 파일 존재·내용 검증 수준, task-4 정규식은 거절문 인용 시 오탐 가능.
- Go Free 세션 한정 및 Zen 미공개 한도는 live 호출 전까지 미검증(잠정 표시).

## 3. PR #191 및 CI 상태 분석

- PR #191 (`dev` → `main`, v1.4.0 릴리스 PR): State OPEN, MERGEABLE.
- 원격 HEAD: `5532dac` (push CI `39243541540`은 docs-only로 5초 fast-pass 성공).
- PR CI (`39243548298`): **CANCELLED (6시간 타임아웃 초과 취소)**.
  - 확인 사실: `pull_request` 이벤트는 전체 diff(#180 코드) 대상이므로 full check 실행.
    최종 로그 출력이 `tests/insights-calibration-cli.test.ts:74`의 fresh-DB fail-fast 직후 중단(11:18:04Z).
    6시간 대기 후 GitHub Actions 최대 실행 시간 초과로 강제 취소됨.
  - 원인 분석(추정): `openCalibrationStore({ YOROI_DATA_DIR: '/proc/invalid/read-only-path-fail' })`가
    Linux runner procfs 상에서 mkdir/open 호출 시 무응답 프리즈를 유발했을 것으로 추정함(직접 재현 전까지는 미확인 가설).
- 로컬 미게시 커밋: `e3abe25` (하네스 크로스 레포 학습 반영 및 CI docs-only 항상-validate 분리).

## 4. w1 CI 테스트 수정 독립 리뷰 및 권고

1. w1 수정 2개 테스트 검증 (독립 리뷰 PASS):
   - `tests/insights-calibration-cli.test.ts`: procfs 의존성을 제거하고 `blockRoot/file` 아래 `db`를 여는 deterministic `ENOTDIR` 예외로 교체. 기존 fresh-DB 첫 실행 저장 검증(`store.listRuns('test').length === 1`) 완벽 보존 확인.
   - `tests/insights-calibration-store-open-failure.test.ts`: child spawnSync로 main CLI 실행 시 저장소 열기 실패가 fail-fast(exit 1)하여 runner·모델에 닿지 않음을 60초 타임아웃 격리 하에 실증.
   - 2개 파일 8개 테스트 194ms 통과 확인.
2. 로컬 커밋 동기화: 하네스 커밋 `e3abe25`를 PR #191에 포함하여 push할지 결정 필요.
3. 이슈 종결: PR #191 머지 시 `Closes #180`에 의해 자동 종료 예정 (수동 close 금지).
