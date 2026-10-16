# 역할 점수 보정 제품 출력 검증 (working tree, 2026-10-16)

- 목적: source freeze 상태에서 제품 데이터 경로와 실제 렌더 결과를 대조했다. 작업 대상은 지정된 /tmp 러너·출력·본 문서뿐이다. 코어 source와 tests는 수정하지 않았다.
- 입력: 고정 공개 스냅샷 18,000 records(AA 2026-10-15 5,453 rows), 동결 Free 2 plans/12 models, publication 2026-10-15, previous cohort 20 rows. OpenRouter 최신 comparisonDate는 2026-10-13, OpenCode Data는 2026-10-14.
- 파이프라인: latest comparisonDate, previousRanks/cohort, Free 입력을 거쳐 현재 working root의 실제 scorer와 renderTop10Letter를 불렀다. mock product rows는 만들지 않았다.
- 1.0.1 native control 재현: 두 role 모두 rawTop == #160 control, product 순위·effort·rawScore·▽ == direct raw candidate 순서가 true. normalRankScores 기반 표시도 제품 scoreText와 일치한다.
- 모집단 및 보정 통계(평균 ± population SD, median):
  - 오케 38개: raw 44.43 ± 25.71, median 44.33 → 표시 50.03 ± 9.77, median 50.
  - 워커 19개: raw 55.58 ± 10.85, median 55.13 → 표시 50.00 ± 9.67, median 50.
- 두 role 모두 Grok 4.7·4.6이 eligible이며 Top10 밖이다. 워커 10행은 #160 raw control과 일치하고 표시값만 정규 점수로 변환됐다.

## 오케스트레이터 Top10

| raw rank | 모델 | effort | rawScore | scoreText | ▽ |
| --- | --- | --- | ---: | ---: | --- |
| 1 | claude-opus-5-5 | medium | 89.42 | 72.2 | |
| 2 | gpt-6-1-sol | medium | 82.72 | 67.6 | |
| 3 | claude-sonnet-5-5 | xhigh | 81.96 | 65.1 | |
| 4 | claude-haiku-5-5 | max | 81.41 | 63.3 | |
| 5 | gpt-6-luna | max | 71.39 | 61.8 | ▽ |
| 6 | muse-spark-1-3 | max | 70.06 | 60.6 | ▽ |
| 7 | gpt-6-sol | max | 68.42 | 59.5 | ▽ |
| 8 | deepseek-v4-1-flash | high | 68.19 | 58.5 | ▽ |
| 9 | mimo-v2-6-pro | default | 66.86 | 57.6 | ▽ |
| 10 | glm-5-3-flash | max | 65.97 | 56.7 | ▽ |

## 워커 Top10

| raw rank | 모델 | effort | rawScore | scoreText | ▽ |
| --- | --- | --- | ---: | ---: | --- |
| 1 | gpt-6-luna | max | 76.98 | 69.4 | |
| 2 | claude-haiku-5-5 | max | 71.53 | 64.1 | |
| 3 | muse-spark-1-3 | max | 69.34 | 61.2 | |
| 4 | deepseek-v4-1-flash | max | 66.38 | 59.0 | |
| 5 | claude-sonnet-5-5 | max | 61.32 | 55.5 | |
| 6 | mimo-v2-6-flash | default | 61.29 | 54.1 | |
| 7 | glm-5-3-flash | default | 57.47 | 52.7 | |
| 8 | gpt-6-1-sol | medium | 55.80 | 51.3 | |
| 9 | glm-5-3 | max | 55.13 | 50.0 | |
| 10 | gemini-3-8-flash | medium | 50.68 | 47.3 | |

## 실제 preview 및 제한

- /tmp/yoroi-normal-final-letter-preview.md는 renderTop10Letter의 수정 없는 실제 출력이며 NaN/Infinity 문자열은 없다. 양 role section은 포함된다.
- 출력은 3,655자로 3,600 예산을 55자 초과했고, renderer의 Free 축약 경로 때문에 Free 섹션은 빠졌다. source freeze 지시에 따라 source 수정·preview 수동 보정 없이 이 결과를 기록했다.
- machine checks와 row별 보정 기대값은 /tmp/yoroi-calibrated-letter-verify.json에 있다. 검증은 현재 dirty working tree 기준이며 clean 재구성 결과와는 별개다.
