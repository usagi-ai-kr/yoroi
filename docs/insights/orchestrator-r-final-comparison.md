# R clean 1.0.2 최종 비교 (선형 I/(P+.01))

## 구성·검증
- base origin/main `698898767` archive + R allowlist. worker hunk 제거. 버전 1.0.2. manifest 파일별 해시 기록.
- clean `pnpm run check`: 단위 1027/1027(worker-effort-source 2건 제외), BDD 45·632, build PASS. 원본 validate PASS.
- 입력: 공개 18k + 동결 Free. **native 1.0.1 control이 #160 오케·워커 20행과 완전 일치**(동일 옵션: comparisonDate 최신 필터·previousRanks·cohort·Free).
- Free 입력은 현재 조회값을 동결해 원본 표와 검증한 값이며, 게시 당시 raw는 아니다.

## 오케 최종 순위 (R raw, 선형 I/(P+.01))
| rank | model | effort | R raw | #160 |
| --- | --- | --- | --- | --- |
| 1 | claude-opus-5-5 | medium | 89.4 | 1 |
| 2 | gpt-6-1-sol | medium | 82.7 | 3 |
| 3 | claude-sonnet-5-5 | xhigh | 82.0 | 2 |
| 4 | claude-haiku-5-5 | max | 81.4 | 4 |
| 5 | gpt-6-luna | max | 71.4 | 10 |
| 6 | muse-spark-1-3 | max | 70.1 | 5 |
| 7 | gpt-6-sol | max | 68.4 | 6 |
| 8 | deepseek-v4-1-flash | high | 68.2 | 7 |
| 9 | mimo-v2-6-pro | default | 66.9 | - |
| 10 | glm-5-3-flash | max | 66.0 | - |

- 진입 mimo-v2-6-pro·glm-5-3-flash, 이탈 grok-4-7·grok-4-6. **Grok 둘은 자격(eligible) 유지, Top10 밖**.
- 워커 10행: #160(=1.0.1)과 완전 불변(모델·effort·점수).

## 정정
- 이전 문서의 `70.8`(grok-4-7)은 **최신 필터 없는 bare preview** 값이다. 정식 표는 위이며 grok-4-7은 순위 밖이다.
- opus 89.4: bare preview 89.3과 차이는 옵션(comparisonDate 최신 필터) 누락 때문이다.
