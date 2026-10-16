# PR #166 CI 사전 점검 (w3, yoroi-166-ci-preflight-w3)

- 범위: 5분 읽기 전용 점검. ready, merge, 재실행, 원격 write 없음. 소스·문서·설정·테스트·git·레터·API 변경 없음.
- 위임 구분: 1.0.x 마무리 위임(commit·push·PR·CI 통과 후 merge·release·global)은 유효하다. 이 패킷만 읽기 전용이라 ready와 merge는 하지 않았다. 추가 승인이 필요하다고 가정하지 않는다.

## 1. PR #166 상태
| 항목 | 값 |
|---|---|
| URL | https://github.com/qus0in/yoroi/pull/166 |
| 상태 | OPEN, isDraft true, mergeStateStatus CLEAN, reviewDecision 없음 |
| head / base | dev `c9fde22a10fd96b313d3172e054d06246719d160` / main `698898767c15f2da18cb6cbdb18ff9e8ca969f21` |

## 2. PR 필수 CI (head c9fde22)
| run | event | head | 결과 | 비고 |
|---|---|---|---|---|
| 38839789044 | pull_request | c9fde22 | success | PR 필수 체크. Classify 성공, docs-only fast pass 건너뜀, Validate·Install·Check(typecheck·tests·BDD·build) 성공 |
| 38839374562 | push | c9fde22 | success | dev push 실행. PR 필수 체크 아님 |

- 수동 dispatch(main, run 38756647568 @698898767, success)는 PR 필수 체크를 대신하지 않는다.

## 3. workflow 트리거 (`.github/workflows/ci.yml`)
- `pull_request`: base main, types opened·synchronize·reopened·ready_for_review. 드래프트를 건너뛰는 조건이 없어서 draft PR도 실행된다(현재 run이 그 예).
- `push`: branches dev. main 머지는 push 트리거가 없다. main CI는 수동 실행이다.
- `workflow_dispatch`: 입력 없음.
- `concurrency`: PR 번호 또는 ref 기준. 새 실행이 진행 중인 실행을 취소한다.
- scope 분류: docs-only 변경이면 Fast pass 후 success. 코드 변경이면 전체 check가 돈다.

## 4. 최종 push·ready 후 성공 확인 절차 (준비만, 미실행)
1. 최종 push 후 `gh run list --workflow ci.yml --event pull_request --limit 5 --json databaseId,headSha,status,conclusion`에서 headSha가 새 head인 run이 completed·success인지 확인한다.
2. 코드 변경이 포함되면 Check 단계 success를 확인한다. 문서만 바뀌었다면 Fast pass success가 정상이다.
3. ready 전환 후에는 `ready_for_review` run이 새로 생기므로 같은 방식으로 확인한다.
4. `gh pr checks 166`에서 ci 항목이 pass이고 head 일치하는지 본다.
5. 머지 후 main CI: `gh workflow run ci.yml --ref main`(원격 write, 머지 후 위임 범위)을 실행하고, `gh run list --workflow ci.yml --branch main --event workflow_dispatch`에서 headSha가 머지 커밋이고 success인지 확인한다.

## 5. compact 문구 독립 검토 (ROOT 워킹트리, 미커밋)
| 기준 | 판정 | 근거 |
|---|---|---|
| 원점수 공식 | 보존 | `스코어 = 100 × Σ(가중치 × 차원값)` 줄 유지 |
| 모델 | 보존 | 모델명 문자열 변경 없음 |
| 수치 | 보존 | 가중치 70/5/10/15, 30/20/10/40은 config/score-weights.json과 일치. 보너스 캡 5 유지 |
| 4차원 | 보존 | 가중치 줄에 성능·사용량·속도·가성비/가격 명시 |
| 50 정규 의미 | 손실 없음 | compact 배열에 원래 없음(HEAD 0건). 이번 diff로 바뀌지 않음 |
| 중복 설명만 축약 | 아님 | HEAD의 `성능·속도: 오케 AA·Cog, 워커 AA / 사용량: OR·OCD` 줄이 compact에서 사라졌다. compact의 다른 줄과 중복이 아니다. 파일 주석의 "정보 동일"과 맞지 않는다 |
| 가중치 생성 | 주의 | 기존 weightsText 생성을 리터럴로 바꿔 config 변경 시 드리프트 위험이 생겼다 |

- 판정: **조건부**. 소스 귀속 줄을 짧게 복원하고 budget 테스트를 다시 돌리면 수용 가능하다.
- PR head c9fde22에는 영향이 없다. HEAD 버전이 소스 줄과 생성식을 유지한다.

## 6. 소스 해시 (검토 기준)
- `src/insights/letter-markdown-format.ts`: ROOT `cb1e9b2e470c9ce1…`, HEAD `7ba12d7019a34a95…`
- `tests/insights-top10-render.test.ts`: ROOT `120245448ee6634e…`, HEAD `c686c71c09d8e61d…`

## 7. 테스트·w4 상태
- 관련 테스트 3파일(top10-render, render-top10, letter-top10) 15/15 PASS. ROOT 기준, 위 해시에서 1회 실행했다.
- PR run 38839789044는 c9fde22의 전체 check(tests·BDD·build)가 success였다.
- w4 예산 보고는 디스크에서 찾지 못했다(working). 따라서 위 해시 기준 조건부 판정이며, 최종 소스 변경이 없을 때만 적용된다. 무기한 대기는 하지 않았다.

## 8. 잔여
- w4가 소스 귀속 줄 복원 여부를 결정한다.
- ROOT compact 변경을 커밋에 포함할지는 후속 커밋 경계에서 정한다.
- ready, merge, release, global은 위임 범위 안의 후속 단계이며 이 패킷에서는 실행하지 않았다.
