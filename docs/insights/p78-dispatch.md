# p78 분배: 남은 작업 분담 (2026-10-14 사용자 "분담하여 진행")

o(`w12:p13`)는 분배만 맡는다. 단계마다 앞 보고를 o가 확인한 뒤 다른 워커로 넘긴다. push·머지·커밋 금지.
D(PR #140 머지)는 메신저가 처리한다. 결과: `scratch/reports/yoroi-p78-<이름>.md`.

## A. p77 레터 수정 (상세 근거: p77-dispatch.md, 보고 yoroi-p77-w1i·w2i)

1단계 결과(o 확인):
- I3(w2): cat-jam은 수집 정상(로컬 카탈로그 `opencode`·`opencode-go`에 `cat-jam-free`).
  Free 표가 역할별 `entries.slice(0, limit)`만 행으로 만들어 상위 밖 랭크 모델이 빠진다(`letter-markdown-free-sort.ts:28-42`).
  같은 이유로 exo·ling-3-0-flash-fin·nemotron-3-5-lightning·space-bunny도 누락됐다.
- I2(w1): mimo-v2-6-flash 매칭 정상(AA 지수 37.9). 오케 ✗는 정당 미달(53.8 < 최고×0.85).
  워커 '-'는 코딩 지수 결측으로 하한 탈락한 것인데 '근거 없음'으로 잘못 표시된다. Free 표에 AA 지수 열이 없다.
  flash·pro 분리와 mimo-v2-5 배제는 정상이다(변경 없음).
- F1(w3): 15:43 늦게 완료 보고(헤더 문구 제거, letter-issue.md 내부 기록, Free 9/9). o가 미실행으로 오판 → 2b 취소.
  2a(w2)가 같은 파일을 동시에 수정했으므로 2a 후 F1 보존 여부를 o·2c가 확인한다.

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| 2a | w2 | Free 표 수정(아래) | yoroi-p78-w2a-report.json |
| 2b | — | 취소(F1 완료) | — |
| 2c | w1 | 리뷰(2a+F1, 읽기 전용)·F1 보존·typecheck·전체 test·validate | yoroi-p78-w1r-report.json |
| 2d-L | w4 | 워킹트리 렌더 → `letter-2026-10-14-p78.md` | yoroi-p78-w4l-report.json |
| 2d-P | w3 | #138 본문 갱신·댓글 1줄 (2d-L 확인 후) | yoroi-p78-w3p-report.json |

2a 요구 (`letter-markdown-free{,-sort,-table}.ts`, Free 테스트):
1. 상위 limit 밖이라도 역할 목록에 랭크된 Free 모델은 행으로 넣는다. 셀은 통과 `✓ 스코어`, 미달 `✗`.
2. 근거(AA 지수·속도·단가 등)는 있는데 성능 하한·결측으로 역할 후보에서 빠진 모델은 그 칸을 `✗`로 한다. `-`는 근거가 전혀 없을 때만 쓴다.
3. Free 표에 `AA 지수` 열을 추가한다. 메인 표 `indexText`와 같은 값이고, 없으면 `-`.
4. 정렬 규칙(p75 B)은 유지한다. flash·pro는 합치지 않고, mimo-v2-5 배제는 유지한다.

## B. 로드맵 1.0 기록 — w4 진행 중(p77-dispatch.md 별도 단위 R, 보고 yoroi-p77-w4r-report.json)

## C. #119 (0.12.0, Cursor·xAI 요금제)

| 단계 | 워커 | 범위 | 보고 |
| --- | --- | --- | --- |
| C1 | w3 | 읽기 전용 조사: #119 본문·댓글, `docs/insights/sources-cursor.md`, `src/insights/plan-catalog.ts`의 현재 반영분 대조 → 남은 항목 목록(요금제·한도·모델별 근거 유무). 웹 확인이 필요한 항목은 "사용자 승인 필요"로 표시 | yoroi-p78-w3c-report.json |
| C2 | 보류 | C1 결과 근거 있는 미반영 항목 없음 → 웹 확인 사용자 승인 대기 | — |

C1(w3) 결과: 현재 반영 = cursor 플랜 1개(grok-4-7·4-6·4-5·composer-2-5, billing pool, `plan-catalog.ts:49,89-91`). 남은 항목(모두 웹 근거 필요): 등급별 Plus/Premium/Super/Ultra 행, 주간 풀 한도 절대값·가격, Grok Bot/X Premium 표기, xAI 사용량 수집 경로.

## 공통 금지

커밋·push·머지, 실제 API·네트워크·웹 호출(승인 전), `--refresh`, 모델·세션 변경, 시크릿 노출, 소유 밖 수정, 파일당 100줄 초과.
