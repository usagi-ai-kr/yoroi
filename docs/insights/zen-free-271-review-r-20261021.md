# Zen Free #271 최종 리뷰 (r · 2026-10-21)

- 패킷: yoroi-271-final-r · 독립 검증(코드 diff·실행·문서·설치본 대조) · 금지: 커밋/push/PR/설치/외부쓰기/Postgres/세션·모델 변경/비소유 수정.
- 근거: issue #271 + w1(tmp/yoroi-271-plugin-w1-report.json)·w2(tmp/yoroi-271-docs-w2-cleanup-report.json) 보고서.

## 1. 코드 독립 검증 (diff 직접 대조)

- **signals.js(22행)**: `shouldRecord = limitError(error, freeScope(model))`만 — 429 단독 fallback 제거 ✓.
  #271 관측("Upstream request failed: Endpoint is unavailable."·type=provider.rate-limit)은 usage/limit 정규식·
  `Free usage exceeded`·free 확인 `Rate limit exceeded` 어느 쪽도 아니라 무기록 판정 — r 산술 확인 일치.
- **release.js(74행)**: wait 15s 실패(타임아웃·예외) → 즉시 폐기 대신 `ctx.session.context()` 재확인 ✓.
  --ok 발행 조건 = `time.completed` 숫자 + `finish==='stop'` + freeScope + `model.id===modelId` 전부 ✓.
  그 외(미완료·finish 불일치·모델 불일치·context 예외) no-clear 유지 · MAX_PENDING/MAX_SETTLED 256·
  settled/settling 중복 방지·FIFO 상한 모두 유지 — 무관 변경·소유권 침범 0.
- **플러그인 엔트리(yoroi-zen-free.js, 88행) 무수정**: retry 훅은 shouldRecord만 통과, http.response 429는
  free 확인 세션 + 유효 retry-after/-ms + 범위(≤366일·길이<128)일 때만 exceeded — 기존 경로 그대로 ✓.

## 2. r 직접 실행 (별개 새 실행 증거)

- 표적 테스트 3파일: **18/18 pass**(plugin 7·release 7·signals 4 — 통합 시나리오 포함).
- 전체 `pnpm run check`: **EXIT=0 · 1480/1480 · BDD 45/635** — w1 로그(17:00)와 별개 실행으로 재확인.
- `validate-repo.py` 위반 0건(1073 files) · `git diff --check` clean · 파일당 100줄 이하(22·74·88·95·96·53).
- **기존 테스트 약화 없음**: 제거된 3건(free 429 기록·유료 429 무기록·wait timeout no-clear)은 전부 #271이
  요구한 의도된 동작 갱신이며 새 테스트가 더 강한 커버(dedup·LRU 256·no-clear 조합·정상 ok)를 가진다.

## 3. 통합 시나리오 — 합성으로 충족, live는 잔여 명시

- signals.test의 플러그인 레벨 시나리오(일시 429→exceeded 없음 · quota 429→1건 · 2xx+wait timeout+completed
  →--ok 1회)가 **실제 createPlugin 훅 경로 + 실제 createRelease settle**을 구동 — 실코드 경로 검증 충족 ✓.
- **live free 호출 재현은 미실시** — 설치본이 구버전(signals·release DIFFERS, yoroi-zen-free SAME)이므로
  환경 재현은 설치 동기화 후에만 가능. 이슈 체크박스의 '실제 free 호출' 항목은 잔여 사용자 검증으로 명시.

## 4. 문서 정합 (계약 100행 · 위키 50행 · 관계 38행)

- 계약 :36-37(표식 없는 429 무기록·기록 2형태) · :44(retryAt 경과 자동 해제 없음) · :53(wait timeout 후
  context 재확인 → --ok 1회) = 코드와 정확 일치 ✓. 위키 :41-46 판정 범위·오탐 방지·해제 지연·표시/해제 차이 ✓.
- 관계 문서: #97(초기 결함)·#118(V2 재작성)·#271(잔여 2원인) 관계 + 설치본 DIFFERS·live 재현 미검증 표기 정확 ✓.

## 5. 판정 — PASS

- **-commit/PR + `node scripts/opencode-hook.mjs install --target v2` 설치 동기화 허가 상태** —
  #271 완료 기준(표식 없는 429 무기록·wait timeout 재확인·합성 통합·문서) 충족.
- 게시·설치 자체는 다음 사용자 승인 패킷에서 실행(r은 금지 유지). 설치·재시작 후 live free 호출 재현 1회
  확인과 retry-after 경계값 관찰을 이슈 종료 전 잔여 확인으로 권고.
- 비차단 사항: w1 보고서 줄 수 표기 일부 불일치(release 74·entry 88·signals 22 실측; 보고서 96/95/21) —
  100줄 규칙은 실측으로도 충족. signals.test.ts는 수정이 아니라 신규 파일(untracked) — 본질 영향 없음.
