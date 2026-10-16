# 최종 독립리뷰 (w3, yoroi-normal-final-review-w3)

- 범위: 즉시 최종리뷰 5분. 수학 심층리뷰는 완료 상태라 반복하지 않음, 대규모 숫자 오라클 미반복. source·config·tests·git·원격·API 편집 없음.
- 순서: source 판정 먼저, coverage는 manifest 대기 없이 현재 diff 기준으로만 확인.

## source 판정
| 항목 | 판정 | 근거 |
|---|---|---|
| w4 unified finite 표시 guard | PASS | `letter-top10-unified.ts:48` `scoreText: Number.isFinite(cal.get(s)) ? …toFixed(1) : '-'`, `rawScore: s.score` 보존 |
| w4 calibration 5번째 테스트 | PASS | 파일 untracked로 직접 읽음. all-invalid → `scoreText '-'`, `rawScore` NaN 유지 단언 |
| 타입 | PASS | `tsc -p tsconfig.json --noEmit` exit 0, error 0건(이전 calibration 76행 오류 해소) |
| 가드 관련 테스트 | PASS | calibration·unified·score-normal 20/20 통과 |
| NaN/Inf 표시 '-' | PASS | `scoreText`의 유일한 대입 지점이 guard. render·legend·markdown은 `?? '-'`, free-sort는 '-'를 결측 처리 |
| rawTrace·원순위 | PASS | 정렬 키는 raw(`score.ts:99` belowZone 뒤 `b.score`), 변경 없음. 워커 raw 단언 유지 |
| ▽ 존 | PASS | `score.ts:95` `belowZone: s.score < cutoff`(raw), guard는 표시만 변경 |
| 대표 effort·components | PASS(guard 한정) | guard diff에 대표·components 변경 없음 |
| 대표 불변(워커 실행코드) | BLOCK | 아래 score.ts 항목 |
| clean score.ts 워커 실행코드 = origin/main | BLOCK | 워킹트리 diff에 워커 전용 effort fallback hunk 잔존: `score.ts`의 `chosen/aaFallback/effort = r.aaEffort?.has(chosen) ? chosen : aaFallback ?? chosen`, `role !== 'orchestrator'` 분기. origin/main은 `best(m)?.[0] ?? 'default'`. cog effort가 aa effort에 없으면 워커 repEffort·raw가 달라짐 |
| score.ts 나머지 diff | PASS | 워커 PARTS 항목 동일, 오케 price 2-leg 추가(R), docstring·주석 변경만 |
| four-source 기존 워커 설명 보존 | BLOCK | 성능 행 워커 설명이 "워커·메신저=p85부터 Intelligence·최댓값"에서 "워커: AA Intelligence만(Cog 정답률은 가산 입력)"으로 바뀜(dirty 워커 hunk). 클린 후보에서 원문 복원 필요 |
| four-source 나머지 | PASS | 제목·사용량 0.05·오케 가중·오케 가성비 행은 R 변경. 워커 가격 설명 원문 보존 |
| "1.1 dirty hunk" 식별 | 미확정 | 문서에서 "1.1" 라벨을 찾지 못함. 내용으로 성능 행 워커 hunk를 dirty로 식별 |
| 원본 dirty5 보존 | PASS | score.ts·four-source·worker-effort test·orchestration.md·takeover 5개 모두 존재(M 3, ?? 2), 삭제 0 |

## w2 기존 테스트 정정 (표본)
- rawScore 단언: 삭제 0건, 추가 29건. 원점수 불변 단언은 유지.
- 삭제 단언 표본 6건 확인: R 의미 변경(가성비 복구, 가중치 0.05/0.10/0.15)에 따른 값·메시지 갱신. 약화 패턴(deepEqual→ok 등)은 표본에서 미발견.
- 표시 단언 분리: 표시(scoreText) 단언은 calibration 테스트로 분리. 기존 다수 테스트는 raw 단언으로 치환됨.
- 비차단 메모: `observed original zero prices remain zero…` 제목이 `cost === 1` 단언과 불일치(제목 stale).
- 전수 대조는 미완료(표본 기준).

## coverage (pending, 대기 없음)
- 현재 diff 기준 체크: core 4/4, render 4/4, guard+normal 4/4, oldR 테스트 4/4, tests 5/5, docs 7/8.
- docs/roadmap.md: 미변경. `rootplan` 대상은 문서에서 정의를 찾지 못해 미확정.
- 52 manifest: 도착하지 않음(w2 재구성 중). 현존 manifest 2종은 현재 diff와 불일치.
  - score.ts 해시 0f766be8… ≠ r-clean 0c43788d… / normal-clean e5ec2c7b…
  - four-source 해시 e1cbe073… ≠ r-clean 4a5fc075… / normal-clean 9a3c1c9e…
  - r-clean(50항목)은 release-status·tasks·ban 누락. normal-clean(75항목)은 포함.

## 차단 해제 조건
1. score.ts 워커 effort fallback hunk 제거(origin/main 원문 복원).
2. four-source 성능 행 워커 설명 원문 복원.
3. 52 manifest 재생성 후 해시 재대조, rootplan 대상 확정.
4. 1~2 적용 후 clean 후보에서 score.ts 워커 블록을 origin/main과 재대조(실제 diff 기준).

## 검증 명령
- `node --import tsx --test` calibration·unified·score-normal: 20/20.
- `node_modules/.bin/tsc -p tsconfig.json --noEmit`: exit 0.
- `git status`·`git diff origin/main -- <file>`(읽기 전용).
