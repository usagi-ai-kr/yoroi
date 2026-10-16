# 역할 점수 정규 순위 보정 preview (수학 단계)

- 정본 helper `normalRankScores`를 고정 exact-control 모집단(오케 38·워커 19)에 적용한 **수학 preview**다. **통합 제품 출력이 아니다**.
- raw 순위는 불변, 표시 점수만 50중심·SD 약10으로 변환한다. ▽·존은 raw 기준.

## 오케 (raw mean 44.43±25.71 → cal 50.03±9.77)
| raw rank | model | effort | R raw | 정규 표시 | ▽ |
| --- | --- | --- | --- | --- | --- |
| 1 | claude-opus-5-5 | medium | 89.42 | 72.22 | |
| 2 | gpt-6-1-sol | medium | 82.72 | 67.57 | |
| 3 | claude-sonnet-5-5 | xhigh | 81.96 | 65.08 | |
| 4 | claude-haiku-5-5 | max | 81.41 | 63.28 | |
| 5 | gpt-6-luna | max | 71.39 | 61.83 | ▽ |
| 6 | muse-spark-1-3 | max | 70.06 | 60.59 | ▽ |
| 7 | gpt-6-sol | max | 68.42 | 59.50 | ▽ |
| 8 | deepseek-v4-1-flash | high | 68.19 | 58.51 | ▽ |
| 9 | mimo-v2-6-pro | default | 66.86 | 57.60 | ▽ |
| 10 | glm-5-3-flash | max | 65.97 | 56.74 | ▽ |

## 워커 (raw mean 55.58±10.85 → cal 50.00±9.67)
| raw rank | model | effort | R raw | 정규 표시 | ▽ |
| --- | --- | --- | --- | --- | --- |
| 1 | gpt-6-luna | max | 76.98 | 69.38 | |
| 2 | claude-haiku-5-5 | max | 71.53 | 64.12 | |
| 3 | muse-spark-1-3 | max | 69.34 | 61.19 | |
| 4 | deepseek-v4-1-flash | high | 66.38 | 58.99 | |
| 6 | claude-sonnet-5-5 | max | 61.32 | 55.55 | |
| 7 | mimo-v2-6-flash | default | 61.29 | 54.07 | |
| 8 | glm-5-3-flash | default | 57.47 | 52.67 | |
| 9 | gpt-6-1-sol | medium | 55.80 | 51.32 | |
| 10 | glm-5-3 | max | 55.13 | 50.00 | |
| 12 | gemini-3-8-flash | medium | 50.68 | 47.33 | |

- 워커 raw rank 5·11은 ▽(raw 미달)로 top10 밖에 있다. 미측정(`-`) 표시는 raw 기준 유지.
- 한계: n=0은 빈 배열, n=1·전부 동점은 50. finite만 모집단, 동점은 midrank 근사 → mean/SD는 정확히 50/10이 아니다. 원점수 간격은 보정으로 재배분된다.
