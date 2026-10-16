# 1.2.1 레터 산정 개편 명세 (2026-10-16)

## 사용자 요구

1. **오케스트레이터 사용량 지표 제외**: 오케스트레이터·리뷰어 점수에서 사용량(`usage`) 지표를 빼고 `1.2.1`로 다시 산정한다.
2. **오케스트레이터·리뷰어 `luna`·`haiku` 제외**: 오케스트레이터·리뷰어 목록에 `gpt-6-luna`, `claude-haiku-5-5`를 포함하지 않는다(워커는 유지).
3. **Grok 4.6 예외 해제(4.7 최신만)**: `allowOlder`에서 `grok-4-6`을 빼고 최신 `grok-4-7`만 표시한다(`gpt-6-sol` 예외는 유지).
4. **역할 간 속도 결측 대체**: 워커 쪽이나 오케스트레이터 쪽 속도가 없으면(`-`) 비워두지 않고 반대쪽 속도를 끌고 와 반영한다.

## 상세 설계 (o 확정)

### 1. 가중치 및 표시 차원 (`w1`)
- `config/score-weights.json` 및 `SCORE_WEIGHTS_DEFAULTS`(`src/insights/letter-top10-score-weights.ts`):
  - `orchestrator`: `{ "performance": 0.75, "usage": 0, "speed": 0.10, "price": 0.15 }`
  - `worker`: `{ "performance": 0.30, "usage": 0.20, "speed": 0.10, "price": 0.40 }` (불변)
- `displayDimensions('orchestrator')`는 가중치 > 0 필터에 의해 자동으로 `['performance', 'speed', 'price']`(`성능/속도/가성비` 3칸)가 된다.
- `src/insights/letter-top10-legend.ts`의 `LEGEND_LINES` 및 `src/insights/letter-markdown-format.ts`의 설명 문구를 오케 3차원(성능/속도/가성비)·사용량 워커 전용·속도 상호 대체에 맞게 정정한다.

### 2. 역할 간 속도 결측 대체 (`w1`)
- 기존에 해당 역할의 고유 속도가 있는 모델은 점수·표준화 척도가 바뀌지 않아야 한다.
- **오케스트레이터 속도 결측 → 워커 속도 대체**:
  - `pickEffortValues(r, effort, 'orchestrator')`에서 `at(r.aaSpeedE) === undefined && at(r.cogDurE) === undefined`이면 워커 정의인 `r.aaSpeed = extreme(r.aaSpeedE, Math.max)`로 대체한다.
- **워커 속도 결측 → 오케스트레이터 속도 대체**:
  - 워커는 기본 `r.aaSpeed = extreme(r.aaSpeedE, Math.max)`를 사용한다.
  - `dims.speed === undefined`(`r.aaSpeed === undefined`)인 워커 행에 한해, 오케스트레이터 변형 풀(`raws.flatMap(x => orchestratorVariants(x))`) 기준으로 표준화한 해당 모델(대표 effort, 없으면 common/min)의 `cogDuration` 표준화 값을 `dims.speed` 및 `sources['speed:cognition']`(`from.speed = 'cognition'`)으로 끌고 온다.
  - 예: `gemini-4-argon (high)`는 AA 속도가 없으나 오케스트레이터 Cognition 속도(`42`)가 있으므로 워커 표에서도 속도 `42`가 표시되고 점수(10%)에 반영된다.
- 독립 참조 구현 `tests/helpers/dimension-reference.ts`에도 동일한 가중치(`0.75/0/0.10/0.15`)와 속도 상호 대체 규칙을 반영한다.

### 3. 모델 목록 기본값 (`w3`)
- `config/letter-model-lists.json` 및 `DEFAULT_LETTER_MODEL_LISTS`(`src/insights/letter-model-lists.ts`):
  - `allowOlder`: `["gpt-6-sol"]` (`"grok-4-6"` 제거 → `grok-4-7`만 남고 `grok-4-6`은 하위버전 자동 배제)
  - `ban.orchestrator`: `["gpt-6-luna", "claude-haiku-5-5"]` (`common: []`, `worker: []`)
- `loadLetterModelLists`에서 `ban` 하위 키(`common`, `orchestrator`, `worker`) 생략 시 빈 배열이 아니라 `DEFAULT_LETTER_MODEL_LISTS.ban`의 해당 배열 사본을 기본값으로 사용한다.

## 분배 및 소유 파일

| 담당 | 범위 | 소유 파일 |
| --- | --- | --- |
| `w1` (`w12:p17`) | 오케 가중치(75/0/10/15), 속도 상호 대체, 범례/포맷 문구, 스코어·계약 테스트 갱신 | `config/score-weights.json`, `src/insights/letter-top10-score-weights.ts`, `src/insights/letter-top10-score-policy.ts`, `src/insights/letter-top10-score-raw.ts`, `src/insights/letter-top10-score.ts`, `src/insights/letter-markdown-format.ts`, `src/insights/letter-top10-legend.ts`, `tests/helpers/dimension-reference.ts`, `tests/insights-dimension-contract.test.ts`, `tests/insights-c-policy.test.ts`, `tests/insights-top10-source-policy.test.ts`, `tests/insights-markdown.test.ts`, `tests/insights-top10-render.test.ts` |
| `w3` (`w12:p19`) | `letter-model-lists` 설정·기본값(`grok-4-6` 제외, 오케 `luna`·`haiku` 밴) 및 목록·Grok 세대 테스트 갱신 | `config/letter-model-lists.json`, `src/insights/letter-model-lists.ts`, `tests/letter-model-lists.test.ts`, `tests/letter-model-lists-path.test.ts`, `tests/insights-grok-generations.test.ts` |
| `w2` (`w12:p18`) | milestone `1.2.1`·추적 이슈 생성 및 점수/목록 문서·로드맵 갱신 | `docs/insights/score-weights.md`, `docs/insights/four-source-score.md`, `docs/insights/letter-model-lists-1.1.md`, `docs/roadmap.md` |

## 완료 기준
- 오케스트레이터 표에 사용량 열이 빠지고(`성능/속도/가성비` 3열, 가중치 75/10/15%), `gpt-6-luna`·`claude-haiku-5-5`·`grok-4-6`이 오케스트레이터 목록에 나타나지 않는다.
- 워커 표에 `grok-4-6`이 나타나지 않고(`grok-4-7`만 유지), `gemini-4-argon` 등 한쪽 속도가 결측인 모델이 반대쪽 속도를 가져와 `-` 대신 수치로 표시된다.
- 모든 파일 100줄 이하, `tsc --noEmit`, 전체 단위 테스트, BDD, `validate-repo.py` PASS.
