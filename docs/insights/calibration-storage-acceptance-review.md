# Calibration 저장 독립 리뷰 (w1, 2026-10-20)

w3 완료분(`/tmp/yoroi-pr191-review-store-report.json`)을 실diff·테스트·적대
probe로 확인. 소스 수정 없음. PASS를 주지 않는다. 실모델·실비밀·호출 없음.

## 확인됨 (정직 경로)

- 3회 혼합·순서변경·중대위반·단일·구버전·20건상한·상세보존 14/14 통과와
  재조회 판정 일치를 직접 재실행으로 확인했다.
- decode 파손 JSON·null·버전없음·중복키는 throw 없이 빈 tasks로 떨어진다.
- 중첩 포함 화이트리스트가 prompt/response/tool-log/diff/자격을 버린다.

## 문제 1 — 포트 수준 허위 capable (MEDIUM)

- 재현: 과제 전부 실패 + `verdict:'capable', totalScore:100` 레코드를
  `saveRun`에 직접 넣으면 그대로 저장·조회된다. `assertRunRecord`는
  runId/modelId/runAt/tasks 형태만 본다.
- 같은 뿌리: `buildCalibrationRunRecord`가 표본 점수·통과수를
  `run.evaluation`에서 가져와 taskResults와 어긋나면
  `totalScore:100 + verdict:not_recommended` 모순 레코드가 생긴다(실측).
  정상 경로는 일관되나 runner 결과 변조를 막지 못한다.
- 최소 수정: save 시 samples가 있으면 `recomputeAggregateInputs`와 저장
  aggregate 3종 일치를 검증하고 불일치는 거부. 표본 점수는 taskResults에서
  재계산(`computeTaskScore`·`isTaskPassed`)한다. 샘플 없는 구버전은 문서화.

## 문제 2 — 파손 violations_json이 목록 전체를 깨뜨린다 (MEDIUM-LOW)

- 재현: 해당 컬럼 파손 행 1개로 `listRuns`가 throw한다. tasks_json 파손은
  빈 tasks로 복구되는 것과 비대칭이다. 허위 capable는 아니나 가용성 손실.
- 최소 수정: `toRecord` 행 단위 try/catch 또는 파손 행 건너뛰기.
- 참고: 구버전 배열 요소는 무검증 통과한다(표시만 영향). 함께 살균 권장.

## 정보성 메모

- 대표 표본 동점 시 선승(first-wins)이라 순서에 따라 tasks가 달라질 수
  있다. verdict·중앙값은 불변. DB 직접 쓰기로 verdict 열을 바꾸면 그대로
  읽힌다(로컬 DB 쓰기 권한 전제라 위협 모델 밖).

## 남은 일

- checker 구현 완료 후 별도 의뢰로 재검토. 전체 check는 수정 후 worker에 의뢰.

## 후속 해소 확인 (w3 수정분 재실행)

- 문제 1 해소: 위조 capable 레코드가 `totalScore mismatch`로 거부된다.
  표본 점수·통과수도 taskResults 재계산으로 산출됨을 확인. 실측 PASS.
- 문제 2 해소: 파손 행도 목록이 복구된다(행 수 유지). 실측 PASS.
- 결론을 정정한다: 저장 독립 리뷰 문제 2건 해소 확인. PASS.
  구버전 무표본·DB 직접 쓰기 신뢰는 기존 정보성 메모대로 범위 밖이다.

## 후속 해소 확인 (w3 수정분 재실행)

- 문제 1 해소: 위조 capable 레코드가 `totalScore mismatch`로 거부된다.
  표본 점수·통과수도 taskResults 재계산으로 산출됨을 확인. 실측 PASS.
- 문제 2 해소: 파손 행도 목록이 복구된다(행 수 유지). 실측 PASS.
- 결론을 정정한다: 저장 독립 리뷰 문제 2건 해소 확인. PASS.
  구버전 무표본·DB 직접 쓰기 신뢰는 기존 정보성 메모대로 범위 밖이다.
