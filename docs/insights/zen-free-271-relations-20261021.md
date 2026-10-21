# Zen Free 락 문제의 이슈 관계와 검증 범위 (2026-10-21, #271)

- 목적: [#271](https://github.com/qus0in/yoroi/issues/271)이 전승한 경로를 [#97](https://github.com/qus0in/yoroi/issues/97)·[#118](https://github.com/qus0in/yoroi/issues/118)과 연결해, 무엇이 고쳐졌고 무엇이 아직 검증되지 않았는지 정리한다.

## 1. 이슈 관계

| 이슈 | 제목 요지 | 관계 |
| --- | --- | --- |
| #97 | V1 환경에서 정상 완료 후에도 `cleared`가 기록되지 않음 | **초기 결함** — 해제 경로 자체가 없거나 이벤트를 못 받던 단계 |
| #118 | V2 플러그인 재작성 | **해결책 도입** — V2에서 판정과 해제를 분리하고(`signals`/`release`) `ctx.session.*`로 세션 상태를 직접 확인하는 구조로 전환 |
| #271 | 일시 429 오탐 + 해제 wait timeout | **V2 이후 남은 두 원인** — (a) 표식 없는 429가 락으로 기록됨, (b) `ctx.session.wait()` 15초 타임아웃 시 해제 후보가 폐기됨 |

→ #271은 #97의 재발(해제 누락)이 아니라 V2 경로에서 생긴 두 가지 별도 원인이다. 이번 수정은 V2의 판정·해제 규칙만 다루고 V1 경로와 이전 계약은 그대로 둔다.

## 2. 이번 수정 범위 (코드·테스트는 이미 반영, 이 단위는 문서)

- **판정**: 표식 없는 429(예 `Upstream request failed: Endpoint is unavailable.`)는 락으로 기록하지 않는다.
  기록 대상은 ① 명시적 quota 표식(`usage/limit` 유형, `Free usage exceeded` 문구, free 세션에서 확인된 `Rate limit exceeded`) ② `http.response` 429 + **유효한** `retry-after`/`retry-after-ms`뿐이다.
- **해제**: `ctx.session.wait()` 타임아웃·예외 시 후보를 버리지 않고 `ctx.session.context()`로 마지막 assistant를 재확인한다.
  `time.completed` 숫자 + `finish === 'stop'` + 모델 일치를 모두 만족할 때만 `report --ok`를 세션당 1회 발행한다.
- **유지**: `retryAt` 경과 자동 해제 없음(`retry passed (unverified)`는 표시 전용) · 점수·순위·가중치·Free 표 무관 · 댓글·발행 계약 무관.

## 3. 감사 근거 (읽기 전용, 2026-10-21)

- V2 `integrations/opencode-v2/yoroi/signals.js` — `shouldRecord`가 `limitError(error, freeScope(model))`만 사용(임의 429 허용 분기 없음) ✓.
- V2 `integrations/opencode-v2/yoroi/release.js` — `wait` 실패를 catch하고 `context()` 재확인 후 `--ok` 발행 ✓.
- V1 `integrations/opencode/yoroi/signals.js` — `error.name === 'APIError'` + `FreeUsageLimitError` 표식 + `Free usage exceeded`/`Rate limit exceeded` 문구로만 판별 ✓(V1은 HTTP 429 단독 판별 없음 ✓).
- V1 `integrations/opencode/yoroi/state.js` — `session.error`·`session.status(retry)` 경로로 `exceeded` 기록, `cleared`는 별도 보고로 전이 ✓.
- **설치본 대조**: `~/.config/opencode/plugins/yoroi/signals.js`는 저장소와 **다르다**(설치본은 free 모델의 모든 429를 기록하는 구버전) ·
  `~/.config/opencode/plugins/yoroi/release.js`도 **다르다**(설치본은 `wait` 타임아웃 시 후보를 폐기) · `yoroi-zen-free.js`는 동일 ✓.
  → 관찰된 증상은 **오래된 설치본**에서 재현될 수 있으며, 수정 반영에는 `node scripts/opencode-hook.mjs install`이 필요하다(설치 절차는 이 단위 범위 밖 ✓).

## 4. 남은 미검증 항목

- **실제 live free 호출**로 일시 429 → 락 미기록 → 다음 정상 완료에서 `cleared`까지 이어지는 통합 시나리오를 아직 재현하지 않았다(정적 코드 확인과 합성 테스트까지 ✓).
- **quota 범위**(전역/모델별)는 계속 UNVERIFIED다(전역 해제 가정 유지 ✓).
- 설치본 갱신 후 실제 환경 재현 확인이 남아 있다(사용자 조치 영역 ✓).
- `--retry-after` 유효성 판정의 경계값(초 단위·HTTP 날짜·범위 초과)은 코드 규칙으로만 정의되어 있다 ✓.
