# Calibration 환경 경계 리뷰 대응 (w1, 2026-10-20)

## 범위

- 신규: `src/insights/calibration-env.ts` (`buildSandboxEnv(extra, homeDir?)`).
- 수정: `ProcessRequest.envMode` 추가, `NodeProcessRunner` replace 분기.
- 테스트 2건·본 문서. sandbox/runner/checker/task-set·CLI/store는 타 패널 소유.

## 계약

- 고정 API: `buildSandboxEnv(extra = {}, homeDir?)` 위치 인자.
  allowlist만 담은 자식 env를 만든다: PATH 등 최소 실행 변수 + 격리
  homeDir 기반 HOME/XDG + `CALIBRATION_TASK_ID` 명시 extra.
- 기존 통제 힌트 5종 강제: `GIT_DIR`·`GIT_WORK_TREE=/dev/null`,
  `GIT_TERMINAL_PROMPT=0`, `CALIBRATION_SANDBOX=1`, `ALLOW_NETWORKING=0`.
  extra로 우회할 수 없고 비밀·NODE_OPTIONS·HOME도 extra로 못 넣는다.
- `envMode` 기본 merge 유지, replace는 `process.env`를 전혀 합치지 않는다.
- 별도 HOME+cwd는 OS 격리 장벽이 아니다. 그렇게 주장하지 않는다.

## 인증 경계 (정직 기록)

- 현 모듈은 실행 인증 전달을 무조건 제거했다. 토큰 env·자격 파일 복사·
  호스트 HOME 상속 경로가 없으며, 이를 지원하는 옵션도 없다.
- 공식 근거 있는 선택 모델 최소 인증을 명시 옵션으로 지원하는 방안은
  검토했으나 공식 근거가 불확실해 미지원·미검증으로 둔다. 인증 필요 모델
  접속이 검증됐다고 쓰지 않는다. host HOME·전체 환경·자격 자동복사는
  앞으로도 금지다.

## 검증 (exit 0)

- 집중 4/4: 실제 spawn(`/usr/bin/env`) 경계에서 합성 비밀·NODE_OPTIONS·
  호스트 HOME 누락 확인, merge/replace 명시. 결과 출력은 boolean만.
- `pnpm run typecheck` clean. `python3 scripts/validate-repo.py` PASS.
- `git diff --check` clean. 파일 33/39/33/본문서줄 이하(100줄 이하).

## 남은 일

- w2 sandbox homeDir 형제dir·runner env 교체, w3 CLI/store v2는 타 패널 작업.
- Linux 실동작·실인증 경로는 미검증. 원격 CI 선반영 없음.
