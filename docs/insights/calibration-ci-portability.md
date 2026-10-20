# Calibration CI 이식성 기록 (2026-10-20)

## 검증됨 (로컬, darwin)

- 실패 전제: mkdtemp 하위 일반파일 아래 경로로 `openCalibrationStore`를
  열면 결정적으로 throw한다(ENOTDIR 등). OS·권한·root에 의존하지 않는다.
  구 `/proc/invalid` 하드코딩을 이 방식으로 교체했다.
- 저장 열기 실패 시 실제 main 디스패처가 exit 1 + fail-closed 문구를
  내고 runner 실행 전에 중단됨을 자식 프로세스 실행으로 확인했다
  (timeout 60초 제한, 실모델·실계정·공급자CLI 미실행).
- fresh-DB 첫 실행 저장·재개방, 1회 잠정/3회 안정, 버전 상수 기록 유지.

## 미검증 (통과로 쓰지 않는다)

- Linux 동작: 위 실패 모드는 POSIX ENOTDIR 가정이므로 Linux 확인 전에는
  이식성을 확정하지 않는다. CI 통과를 선반영하지 않는다.
- PR #191 CI 취소: 취소 로그만 관측했고 경로 관련 원인은 추정이다.
  확정하지 않는다. 로컬 통과와 원격 CI는 구분해 기록한다.

## 실행 명령 (exit 0)

- `node --import tsx --test tests/insights-calibration-cli.test.ts tests/insights-calibration-store-open-failure.test.ts`
- `pnpm run check`, `python3 scripts/validate-repo.py`, `git diff --check`.
- 작성·수정 파일은 모두 100줄 이하.
