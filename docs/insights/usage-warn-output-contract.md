# #164 사용률 상태 출력 계약 (Output Contract)

- 관련 이슈: [#164](https://github.com/qus0in/yoroi/issues/164) `feat: 사용률 90% 도달 시 warn 상태 추가`
- 대상 포맷: Plain, Pretty, JSON 스냅샷

## 1. 포맷별 상태 반영 계약

### 1) Plain 포맷 (`src/ui/cli/display.ts`)
- 창 행의 라벨 및 단위 바로 뒤 첫 번째 지표로 `usage_status=<상태>`를 출력한다.
- 사용률 90% 이상 98% 미만 행은 `usage_status=warn`으로 출력된다.
- 예시: `  - w [percent] usage_status=warn used=92.00 ...`
- 검증: `tests/usage-warn-render.test.ts`에서 4개 공급자(`opencode-go`, `agy`, `ollama-pro`, `xai`) 전수 검증 완료.

### 2) Pretty 테이블 포맷 (`src/ui/cli/render.ts`, `render-pretty-filter.ts`)
- Status 열에 `ok warn`으로 표시되며, 열 폭(22자) 및 전체 테이블 너비는 불변이다.
- 색상은 `over`의 표준 노랑(`pc.yellow`, ANSI 33)과 명확히 구별되는 밝은 노랑(`pc.yellowBright`, ANSI 93)을 사용한다.
- `SHOWN_STATUSES` 집합(`["limit", "warn", "under", "optimal", "over"]`)에 포함되어 기본(non-full) 표에서도 즉시 노출된다.

### 3) JSON 스냅샷 포맷 (`src/domain/usage.ts`)
- 원칙: 사용량 상태(`optimal`, `under`, `over`, `warn`, `limit`, `n/a`)는 UI/표시 계층 전용 계산값이며, 도메인 `UsageSnapshot` 및 `UsageWindow`의 속성이 아니다.
- JSON 직렬화 시 모든 상태에 대해 `status` 또는 `usage_status` 필드를 일절 포함하지 않는 기존 raw 스냅샷 계약(불변)을 엄격히 준수한다.
- 사용자 지시 없는 임의 필드 확장을 배제하며, 기존 소비자 파이프라인의 호환성을 보존한다.
- 검증: `tests/usage-warn-render.test.ts`에서 JSON 직렬화/역직렬화 시 `usage_status` 부재 및 raw window 보존을 명시적으로 단언한다.

## 2. 정규화 및 결측치 처리 계약

- `percent > used/limit`: `percent`를 최우선으로 취하고, 없을 때만 `used/limit`로 계산한다.
- `remaining` 전용 창: `remaining`만 존재하는 창은 계산 대상이 아니며, `resetAt` 및 예상 비율(exp) 유무와 무관하게 `n/a`를 유지한다.
- 검증: `tests/usage-warn-boundaries.test.ts`에서 exp 유·무 2개 경우 모두 `n/a` 반환을 회귀 단언으로 고정했다.
