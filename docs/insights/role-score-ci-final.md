# PR #166 ready 전환과 최종 head CI (w3, yoroi-166-ready-ci-w3)

- 범위: PR 본문 최종화, ready 전환, 최종 head의 pull_request CI required checks 확인. 머지는 하지 않았다(다음 단계로 분리, release-task 기준).
- 위임: 사용자 기존 1.0.x 머지 승인은 유효하다. 이 단계는 머지하지 않고 CI 결과만 확인한다.

## 1. PR 상태
| 항목 | 값 |
|---|---|
| URL | https://github.com/qus0in/yoroi/pull/166 |
| 상태 | OPEN, isDraft false(ready for review), mergeStateStatus CLEAN |
| head / base | dev `4b30f72cac996eb076680214ca4d14b5b7db7e8d` / main `698898767c15f2da18cb6cbdb18ff9e8ca969f21` |
| 닫는 이슈 참조 | 0건(closingIssuesReferences). #160·#162·#163·#164는 닫지 않는다 |
| 제목 | fix: 오케 가성비 복구와 역할별 정규 점수 보정 (1.0.2) |

## 2. 본문 최종화
- `/tmp/yoroi-166-final-pr-body.md`의 검증 수치를 최종화했다: 단위 1041 → **1042**, validate 680 PASS, 고정 입력 preview 3,562자 추가.
- GitHub 본문 반영 확인: "단위 1042"와 "3,562자"가 포함되고 "단위 1041"은 없다.

## 3. CI (head 4b30f72, event pull_request)
| run | 이벤트 | 시점 | 결과 | 비고 |
|---|---|---|---|---|
| 38843944675 | pull_request | 03:07 | success | draft 상태의 synchronize run |
| 38844392428 | pull_request | 03:12 | 감시 중 | ready_for_review run. 백그라운드 watch(5분 단위, 최대 4회)로 추적 |

- 최종 판정은 아래 "4. 결과"에 기록한다.

## 4. 결과
- 대기 중. 백그라운드 watch 종료 시 run 38844392428의 conclusion, job 결과, PR checks를 여기에 기록한다.

## 5. 머지 이후 절차 (미실행)
1. 머지는 사용자 위임 범위에서 다음 단계로 진행한다. 실행 전에 이 문서의 CI 결과를 다시 확인한다.
2. main CI는 수동 실행이다. `gh workflow run ci.yml --ref main` 후 `gh run list --workflow ci.yml --branch main --event workflow_dispatch`에서 headSha가 머지 커밋이고 success인지 확인한다.
3. tag·Release·전역 CLI 갱신은 main CI 통과 뒤 release-task 절차를 따른다.

## 6. 범위 밖 (변경 없음)
- 레터 발행 없음. 신규 milestone 없음. 이슈 종료 없음. 모델 변경 없음. main 직접 push 없음.
- 워커 p85·cpt/total·effort fallback은 1.1로 이월한다(본문 정책과 동일).
