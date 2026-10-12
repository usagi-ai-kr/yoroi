# Zen Free 실관측 기록 (2026-10-12)

[계약 문서](contracts-opencode-zen-free.md)의 미확인 항목 중 실제 이벤트 수신·수신 문구·로드 기록·정상 응답 해제가 2026-10-11~12 실제 사용에서 관측됐다. 근거는 로컬 DB `~/.local/share/yoroi/yoroi.db`를 읽기 전용(`file:…?mode=ro`)으로 재확인한 값이며, 원문 응답·키는 저장하지 않았다.

## 관측 타임라인 (lock_events)

| # | kind | model | observed_at (UTC) | retry_at (UTC) |
| --- | --- | --- | --- | --- |
| 1 | exceeded | space-bunny-free | 2026-10-11T06:05:41.167Z | 없음 |
| 2 | exceeded | free | 2026-10-11T12:12:43.905Z | 2026-10-11T12:42:43.905Z |
| 3 | cleared | space-bunny-free | 2026-10-12T00:22:01.137Z | 없음 |

- #1: 2소스 중 첫 exceeded. 이전 조사(zen-retry-null)에서 이 오류는 "Rate limit exceeded. Please try again later."였고 Retry-After·`retrying in` 문구가 없어 retry_at이 비었다.
- #2: retry_at = observed_at + 정확히 30분. `retrying in 30m` 문구 또는 Retry-After 헤더 중 어느 경로였는지는 이벤트에 저장되지 않아 구분 불가(둘 다 가능).
- #3 cleared: 정상 응답(성공)에 대한 `--ok` 경로로 해제됐다. 플러그인 `state.js`는 무료 모델의 assistant 완료(`finish=stop`, `time.completed`) 후 idle에서 `--ok --model <모델>`을 보내고, `applyOk`는 scope 락을 clear로 바꾼다(모델 불일치와 무관한 scope 단위).

## 상태 요약 (provider_locks · plugin_loads)

- `provider_locks`: state=clear, locked_at=2026-10-11T06:05:41.167Z, retry_at=2026-10-11T12:42:43.905Z, cleared_at=2026-10-12T00:22:01.137Z.
- 잠금 지속: 2026-10-11T06:05:41.167Z → 2026-10-12T00:22:01.137Z = **약 18시간 16분 20초**. retry_at(12:42)이 지나도 자동 해제되지 않았고 정상 응답에서만 해제됐다.
- 재잠금/중복 exceeded가 있어도 `locked_at`은 첫 exceeded 시각으로 보존됐다(updated_at만 전진).
- `plugin_loads`: 2026-10-12T00:21:48.655Z — 사용자가 OpenCode를 재시작한 뒤 #97 재설치본의 **첫 로드 기록**이 남았다(로드 표시 기능 실동작 확인).
- `yoroi zen-free status`(사용자 실행) = clear.

## 여전히 미확인

- **일일 리셋 여부**: 18시간 지속은 계정별 reset 주기 관측이 아니다. reset 주기·시각은 여전히 미확인이다.
- #2 retry_at의 출처(문구 vs 헤더)와 혼합 모델·동시 세션 순서는 저장 정보만으로 구분할 수 없다.
- 수신 문구의 언어/변형 전체 목록은 이번 1건("Rate limit exceeded…")만 확인됐다.
