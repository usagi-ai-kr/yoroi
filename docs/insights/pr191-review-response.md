# PR #191 리뷰 대응 (2026-10-20)

기준 HEAD 2926b2e. 사용자 지적 3건 수용, PR Draft·Refs #180으로 전환했다.
기존 패널 w1 Muse Spark xhigh / w2 Gemini 3.8 Flash high / w3 MiniMax max 사용.
root 직접 작업 대신 기존 패널 위탁 우선 원칙을 확립하고, AGENTS.md에서 서브에이전트 허용 문구를 삭제했다.

## 공통 계약 및 담당 현황

| 영역 | 담당 패널 | 수정 파일 | 독립 리뷰어 | 판정 |
| --- | --- | --- | --- | --- |
| **HIGH (env 경계)** | w1 | `calibration-env.ts`, `process-port.ts`, `process-runner.ts` | w18:p3 | **수용** (`calibration-env-acceptance-review.md`) |
| **MEDIUM (checker)** | w2 | `calibration-checker.ts`, `fixtures.ts`, `verifier.ts` | w1 | **수용** (`calibration-checker-acceptance-review.md`) |
| **MEDIUM (store)** | w3 | `calibration-record.ts`, `codec.ts`, `store.ts`, `sqlite.ts` | w1 | **수용** (`calibration-storage-acceptance-review.md`) |
| **카탈로그 (MiniMax)** | w1 / w3 | `plan-catalog.ts`, `model-aliases.ts` | w3 | **수용** (`minimax31-acceptance-review.md`) |
| **퍼블리셔 보완** | w1 | `insights-publish-target.ts`, `recovery.ts`, `publish.ts` | w3 | **수용** (`publisher-recovery-acceptance-review.md`) — F1 repo 게이트·F2 본문 정확일치 게이트 해소 확인, publish 집중 18/18·전체 1197 PASS |
| **하네스 위탁우선** | w1 / w3 | `AGENTS.md`, `SKILL.md` 2종, `playbook.md`, `orchestration.md` | w18:p3 | **수용·커밋 완료** (`f4d868d`) |

## 1. w1 — 높음: 자식 환경 경계 (해소 확인)
- `buildSandboxEnv(extra={}, homeDir?)` allowlist 기반 환경. `envMode: 'replace'` 지원.
- 5종 통제 힌트 강제 적용. spawn 경계 합성 비밀·NODE_OPTIONS·HOME 누락 실측 검증.
- 모델 인증은 임의 주측 없이 명시 옵션 미지원·미검증으로 정직하게 기록.

## 2. w2 — 중간: 채점 신뢰도 (해소 확인)
- 파일 존재·단순 exit 0 신뢰 배제, 독립 호스트 검사기 실행 및 fixture 대조.
- 무수정(diff 0), 오답 코드, 변조, 타입오류, exit 밀수 등 6종 음성 반례 차단.
- process.exit 정적 패턴 한계는 완료 토큰 증거 결합으로 보완.

## 3. w3 — 중간: 집계·저장 정합성 (해소 확인)
- SQLite multi-run v2 레코드(`samples`, `taskAggregates`, `aggregate`) 보존.
- 저장 전 taskResults 재계산 기반 일관성 검증(`assertRecordConsistency`)으로 위조 capable 차단.
- 파손 `violations_json` 행 단위 복구 및 비문자열 살균.

## 4. 진행 현황 및 보류 상태 (2026-10-20, w18:p3)
- **제품 코드 커밋**(단위별, `dev`): `6235833` 캘리브레이션 env·store v2 / `b5ad4c7` 퍼블리셔 복구 / `e33a019` MiniMax 카탈로그 / `a49628e` 대응·리뷰 문서.
- **보고서 준비**: `/tmp/yoroi-pr191-response-bodies.json` (#191/#180/#193/#192 대응 초안) 분리 저장 완료.
- **#192 레터 복구 완료**: 댓글 3건 원격 게시([c0](https://github.com/usagi-ai-kr/yoroi/issues/192#issuecomment-6280879673), [c1](https://github.com/usagi-ai-kr/yoroi/issues/192#issuecomment-6280881730), [c2](https://github.com/usagi-ai-kr/yoroi/issues/192#issuecomment-6280882849)) 확인.
- **머지 보류**: PR #191 draft 및 Issue #180 open 유지. Closes #180 보류.
- **런타임 미구현**: #168(자동감지) 및 #190(Arena) 런타임 통합은 미구현 상태 유지.
