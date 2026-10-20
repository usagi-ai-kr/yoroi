# Calibration 자식 환경 경계 독립 수용 리뷰 (2026-10-20)

- 담당: 독립 리뷰어 (w18:p3).
- 대상: w1 작성 `src/insights/calibration-env.ts`, `src/infra/process-port.ts`, `src/infra/process-runner.ts`.
- 검증 근거: `/tmp/yoroi-pr191-review-env-contract-report.json`, `docs/insights/calibration-env-review-fix.md`, 실제 spawn 경계 테스트 4건.
- 원칙: 본인(checker) 코드 자기리뷰 금지, env 코드는 읽기 전용 검증, 실비밀·토큰 노출 금지, 100줄 이하.

## 1. 독립 코드 및 계약 검토

1. **위치 인자 서명 정합성**:
   `buildSandboxEnv(extra: Record<string, string> = {}, homeDir?: string)`
   - w1 초기 구현의 객체 서명 불일치 해소 확인.
   - `calibration-runner.ts`, `calibration-sandbox.ts`, `calibration-verifier.ts` 호출부와 완전 일치.
2. **자식 프로세스 격리 모드 (`envMode: 'replace'`)**:
   - `process-runner.ts`의 `spawn` 실행 시 `envMode === 'replace'` 분기에서 `process.env`를 완전히 배제하고 전달된 `request.env`만 단독으로 공급.
   - 기본값은 `'merge'`로 기존 프로세스 실행 호환성 보존.
3. **통제 힌트 강제 적용 (오버라이드 방지)**:
   - `GIT_DIR=/dev/null`, `GIT_WORK_TREE=/dev/null`, `GIT_TERMINAL_PROMPT=0`, `CALIBRATION_SANDBOX=1`, `ALLOW_NETWORKING=0` 5종이 `extra` 전개 이후 맨 마지막에 강제 적용됨.
   - 악의적이거나 잘못된 `extra` 입력으로도 샌드박스 통제 힌트 무력화 불가.

## 2. 실제 프로세스 경계 검증 (Real Spawn Boundary)

합성 테스트(`tests/insights-calibration-env-boundary.test.ts`, `tests/process-runner-env-mode.test.ts`) 4건 실행:
- `real spawn boundary drops synthetic secrets and host config paths`: 통과 (합성 `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `NODE_OPTIONS`, 호스트 `HOME` 누락 확인).
- `extra allowlist drops non-listed keys and cannot override forced hints`: 통과.
- `merge (default) keeps host env and lets request override`: 통과.
- `replace never merges host env`: 통과.
- 출력 검증: 자식 환경 원본 출력 없이 `boolean` 통과 여부만 확인하여 시크릿 노출 위험 차단.

## 3. 인증 경계 및 한계점 정직성 평가

- **호스트 자격 복사 없음**: 호스트 `~/.config`나 자격 증명 파일을 샌드박스로 복사하지 않음.
- **과장 주장 배제**: 프로세스 레벨의 격리 환경(`HOME`/`cwd`/환경변수 allowlist)이며, 커널 레벨 컨테이너나 완벽한 OS 네트워크 차단이 아님을 문서에 명시함.
- **인증 필요 모델 미지원 명시**: 모델 API 키 주입을 임의 추측으로 허용하지 않고, 현재는 명시 옵션 미지원·미검증 상태임을 정직하게 기록함.

## 4. 최종 수용 판정

- **판정: 수용 (ACCEPTED)**.
- w1의 환경 격리 구현은 PR #191의 보안 및 환경 경계 요구조건을 충실히 충족함.
