# DeepSeek V4.1 Flash Effort 변형 실측 비교 및 선정 근거

## 1. 분석 개요
- **질의 배경**: `max`가 허용됨에도 clean 1.0.2 레터에서 `deepseek-v4-1-flash`가 `high`로 산출되는 원인 규명
- **데이터 기준**: 2026-10-16 공공 벤치마크 스냅샷(AA, Cognition, OpenRouter, OpenCode Data)
- **비교 대상**: ROOT 1.1 미커밋(dirty) 코드 vs Clean 1.0.2 공식 렌더러

## 2. 공공 벤치마크 소스별 실측 현황
| 소스 | 모델 표기 | 관측 Effort | 주요 지표 |
| --- | --- | --- | --- |
| **Artificial Analysis (AA)** | DeepSeek V4.1 Flash (Max) | `max` | Intel 39.5, Speed 179.25 tok/s, 혼합 $0.525/1M, CPT $0.2652 |
| **Cognition FrontierCode** | DeepSeek V4.1 Flash | `high` | Correctness 0.4863, Duration 44.67분, Cost $0.6202 |

> AA에는 `high` 변형이 없고, Cognition에는 `max` 변형이 없어 각 소스가 서로 다른 effort 레벨을 단독 관측함.

## 3. Clean 1.0.2 산출 결과 및 선정 메커니즘
### (1) 오케스트레이터 역할 (전 변형 풀 평가)
- **`high` 변형 (Cognition 기반)**: 스코어 **70.43**
  - 표준화: 성능(Cog) 0.7771, 사용량(OR/OCD) 1.0000, 속도(Cog) 0.3026, 가성비(Cog) 0.5342
- **`max` 변형 (AA 기반)**: 스코어 **62.97**
  - 표준화: 성능(AA) 0.6685, 사용량(OR/OCD) 1.0000, 속도(AA) 0.1216, 가성비(AA) 0.6640
- **판정**: 실측 점수에서 `high` (70.43) > `max` (62.97)이므로 대표 변형으로 `high` 선정.

### (2) 워커 역할 (성능 우위 소스 기반 effort 선택)
- 후보 풀 내 표준화 성능 비교: `perfCog` (**0.7771**) > `perfAa` (**0.6685**)
- Cognition의 표준화 성능이 AA보다 높아 성능 소스로 Cognition의 effort 맵(`r.cogEffort`)을 참조.
- Cognition의 관측 effort는 `high` 단일 변형이므로 `effort = 'high'`로 선정.

## 4. ROOT 1.1 Dirty Preview와의 차이 원인
- **ROOT 1.1 미커밋 hunk (`src/insights/letter-top10-score.ts`)**:
  ```typescript
  const chosen = best(m)?.[0] ?? 'default',
        aaFallback = best(r.aaEffort)?.[0],
        effort = r.aaEffort?.has(chosen) ? chosen : aaFallback ?? chosen;
  ```
- Cognition이 선택한 `chosen`은 `high`였으나, AA effort 맵에 `high`가 없자 `aaFallback`인 `max`로 강제 치환됨.
- Clean 1.0.2에는 해당 fallback hunk가 없으므로 더 높은 성능 표준 점수를 기록한 Cognition의 `high`가 왜곡 없이 정상 반영됨.

## 5. 결론
`max`가 허용 상한으로 열려 있더라도, 공공 벤치마크 실측치상 Cognition의 `high` 변형 점수(70.43 / 0.7771)가 AA의 `max` 변형 점수(62.97 / 0.6685)보다 높기 때문에 Clean 1.0.2 공식 산식에 따라 `high`가 대표 변형으로 선정된 것임.
