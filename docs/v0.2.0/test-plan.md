# SQLite·REST·WebSocket·화면 통합 BDD/E2E 계획 (#54, 설계 초안)

> 준비 단계: 설치·구현 금지. 근거: #30 공통 완료 기준, #31·API·WS·캐시 문서.

## 1. 하네스 재사용 (0.1.0 현행)

- 단위/통합: `node:test` + tsx, `tests/**/*.test.ts` (fake source·HTTP·process·scheduler).
- BDD: Cucumber, `features/**/*.feature` + `features/steps/**/*.ts` (`cucumber.mjs`).
- 합성 fixture: `tests/fixtures/`(agy·claude·codex·opencode-go) + 고정 관측시각 패턴.
- `check` 순서 유지: typecheck → test → test:bdd → build → smoke(build-plan §4).
- 실제 계정·토큰·네트워크 없이 통과. `.env`·시크릿 사용 금지(failure-policy §4).

## 2. 종단 시나리오 (수집→화면)

- 수집→SQLite 기록→REST 조회→WS 알림→전체 카드/상세 탭 갱신을 한 시나리오로 자동화.
- 가짜 공급자 5종 + 가짜 시계: 60초 수집-후-대기 2주기, 단일 수집 주체 확인.
- 카드: 실제 막대 + 확정 창 세로 기준선 1개, 문구 3종(빠르게·여유·초기화까지).

## 3. 수용 시나리오 (장애·경계)

- 공급자 1곳 인증 만료: 격리 표시, 타 공급자·수집 루프 정상(#40).
- 부분 성공 저장, SQLite 실패 시 `degraded` + 캐시 fallback(cache-design §2).
- WS 단절→재연결: REST 재동기화, 끊김값 최신 오표시 금지(websocket-design §3).
- 리셋 직후·재시작: `resetChanged` 1회, 재시작 후 DB fallback 전체 재조회.
- 기준선: 확정 창 일치 확인, 모호 rolling은 숨김(baseline-calc §1).

## 4. 격리 장치 (합성·임시·가상)

- 합성 fixture: 공급자별 정상·만료·부분·리셋변경 응답 세트, 시계 고정.
- 임시 DB: 시나리오별 별도 SQLite 파일, 영구 이력과 분리(#35).
- 가상 포트: 가짜 HTTP·프로세스·소켓, 루프백 바인딩·Origin 거부는 단위 수준.
- 상태 오염 금지: 시나리오 간 캐시·DB·시계 초기화, 병렬 실행 시 파일 분리.

## 5. CI·기록 연결

- docs-only는 fast pass, 그 외 full: frozen install → 확장 `check` → smoke.
- #30 공통 기준 매핑: 60초 주기·역할 분리·개요/상세·확정선·격리·보안·E2E 각 1행.
- 기존 CLI 회귀(`once` 종료코드·`watch` non-overlap)는 그대로 유지·통과 필수.
- 결과는 #54에 자동/수동 검증 근거로 기록, 실패 시 원인·재현 fixture 첨부.
