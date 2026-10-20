# Calibration 채점 신뢰도 리뷰 대응 (w2, 2026-10-20)

## 1. 지적 배경 및 재현

- 지적: 단순 파일 존재/exit0/stdout "passed"만으로 accuracy를 통과시키던 기존 구조의 신뢰도 결함.
- 적대적 재현: `export + process.exit(0)` 밀수로 task-2/3 단언 우회, TS2322 타입오답 통과 간극.

## 2. 계약 및 핵심 수정

1. **격리 homeDir 및 replace 환경**:
   - `createCalibrationSandbox`: 작업 dir 외 형제 `homeDir` 생성 및 동시 cleanup.
   - `buildSandboxEnv(extra, homeDir)` positional 계약 준수, `envMode: 'replace'` 적용.
2. **실제 시작 파일·고정 검증 제공**:
   - `task-2-single-file-edit`: 초기 버그 함수(`x + 1`) 시딩 후 호스트 독립 자식 실행으로 `targetValue(2) === 4 && targetValue(10) === 20` 실측.
   - `task-3-test-fix`: `src/math.ts` 버그 함수(`a - b`)와 고정 `tests/math.test.ts` 시딩.
3. **적대적 우회 차단 (Exit 밀수 & 타입 간극 해소)**:
   - `process.exit` 정적 패턴 차단 (`process_exit_forbidden`).
   - task-2 실행 완료 증거(`__TASK2_VERIFIED__`) 및 task-3 TAP pass 수(`pass >= 1`) 실측 검증.
   - 실제 `tsc` (`--noEmit --strict --ignoreConfig`) 실행으로 TS2322 등 타입 오류 차단 (`type_error`).
4. **고정 fixture 변조 방지 & 버전 분리**:
   - `checkFixtureIntegrity`로 테스트 파일 변조 감지(`fixture_tampered`).
   - task-set `v2`로 승격하여 이전 표본과 분리.

## 3. 검증 결과

- 집중 검증 27/27 통과 (1.9s):
  - `tests/insights-calibration-checker.test.ts` (4 pass, exit smuggle 포함)
  - `tests/insights-calibration-runner.test.ts` (6 pass, replace env & homeDir 확인)
  - `tests/insights-calibration-scorer.test.ts` (5 pass, v2 호환)
  - `tests/insights-calibration-code-verification.test.ts` (2 pass, exit밀수·TS2322·정상)
  - `tests/insights-calibration-fixture-integrity.test.ts` (2 pass, 변조 감지)
  - `tests/insights-calibration-cli.test.ts` (8 pass, 통합)
- `pnpm run typecheck`: clean (exit 0).
- `python3 scripts/validate-repo.py`: PASS (843 files, 8 skills, 위반 0건).
- `git diff --check`: clean (공백 오류 없음).
- 모든 작성 파일 줄 수 ≤ 100줄 규칙 준수.

## 4. 미확인 및 남은 일

- w1의 독립 재검토 대기.
- w3의 CLI/store v2 다중 실행 표본 저장 정합성 반영 후 통합 검증.
- 실모델 호출 및 외부 네트워크 통신 일체 미수행.
