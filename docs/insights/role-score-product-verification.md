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

## 예산 후속 검증

- 기본 발행 경로는 `renderTop10FromRecords → renderTop10Letter`이며 길이 옵션이 없다. `renderInsights` 기본 compact 호출도 같은 결과다. 3,600자는 renderer 계약이고 3,800자는 비교용 상한이다.
- 수정 전 고정 입력은 3,655 JS 문자(3,600 초과·3,800 이하)였고, `>3,500` fallback에서 Free 섹션이 접혔다. 1.0.1 CLI의 기본 경로·예산 코드도 같다. 저장된 1.0.1 full Markdown 3,717자/Free 포함 artifact는 별도 `--markdown` 경로라 직접 비교하지 않았다.
- compact 푸터에서 안내문과 중복되던 차원 출처 한 줄을 제거하고 가중치를 순서형 숫자로 축약했다. 행·모델·effort·rawScore·정규 표시점수·가격·가성비·▽ 의미와 예산 상수는 바꾸지 않았다.
- 현재 고정 입력 preview는 3,597 JS 문자로 3,600·3,800을 통과하고 두 role section 및 Top10 행을 유지한다. Free 섹션은 기존 `>3,500` fallback에 따라 접히며 NaN/Infinity는 없다.
- 1.0.1 고정 입력 재렌더는 약 100초 동안 끝나지 않아 길이와 Free 포함 여부를 측정하지 않았다. 이를 추정하지 않으며, 1.0.1 source의 기본 경로와 예산 fallback은 읽기 전용으로 확인했다.
- `/tmp/yoroi-calibrated-letter-verify.json`의 row별 검증값은 이전 실행 그대로다. 그 파일의 preview count는 수정 전 값이며 최신 길이 결과는 이 후속 기록과 report에 있다. 현재 dirty working tree 기준이다.
- 검증: `tests/insights-top10-render.test.ts` 5/5, 로컬 `tsc --noEmit`, `validate-repo.py`, `git diff --check` 통과. pnpm typecheck는 Corepack registry signature fetch 실패로 거부되어 설정을 바꾸지 않고 로컬 tsc를 실행했다.
- 현재 green snapshot commit/push가 대기 중인 dirty root다. 이번 source/test 변경은 후속 commit에 포함해야 하며, 이 작업에서는 staging·commit·push를 하지 않았다.
