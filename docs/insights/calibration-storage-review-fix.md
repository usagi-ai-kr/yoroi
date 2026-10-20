# PR #191 리뷰 대응 — 캘리브레이션 집계·저장 정합성 (w3, 2026-10-20)

- 범위: `docs/insights/pr191-review-response.md` §w3(중간: 집계·저장 정합성). CLI·store 전담.
- 소유: `src/insights/calibration-{cli,store,store-sqlite,record,store-codec,stored-samples}.ts`,
  `tests/insights-calibration-{cli,store,multirun-store}.test.ts`, 이 문서.
- **결론: 지적 사항 해소 + 회귀 추가. evaluator v2·기존 DB 무마이그레이션.**

## 1. 재현 (수정 전 결함)

`--runs 3` 실행 시 저장 레코드가 **첫 실행 tasks + 3회 중앙값 점수**를 섞어 저장했다.
- `totalScore` = 3회 실행 점수의 중앙값, `sampleCount` = 3, `violationClasses` = 3회 합집합인데
  `tasks` = 1회 실행의 과제 목록 → SQLite 재조회 시 과제별 점수와 총점이 맞지 않고 통과수를 복원할 수 없다.
- CLI 출력도 1회 실행 과제만 찍어(총점·표본은 3회 기준) 같은 근거를 쓰지 않았다.

## 2. 수정

- **레코드 v2**(`calibration-record.ts`): `samples`(표본별 과제·점수·통과수·위반), `taskAggregates`(과제별 최소 점수·통과 수·표본 수),
  `aggregate`(집계 방식 `single|median`, 중앙값 점수·통과 수, 중대위반 여부, 대표 표본 인덱스)를 함께 저장한다.
  `tasks`는 대표 표본의 과제 상세로 남겨 구버전 필드 호환을 유지한다.
- **집계 정의 명시**(`calibration-stored-samples.ts`): `aggregateSamples`은 evaluator의 multi-run 규칙(중앙값·중앙 통과수·중대위반)과
  동일한 값을 산출한다. `recomputeAggregateInputs`는 저장된 표본만으로 그 입력을 다시 계산해 재조회 일치를 확인한다.
- **버전 JSON + 구버전 배열 호환**(`calibration-store-codec.ts`): `tasks_json`에 `{version:'v2', samples, taskAggregates, aggregate}`를 쓰고,
  기존 배열형(구버전) 행은 그대로 읽는다. **스키마 마이그레이션 없음** — 기존 DB는 재개방만 되고 이전 행은 배열형으로 남는다.
- **CLI 출력 = 저장 근거**(`calibration-cli.ts`): 저장 레코드에서 총점·집계 방식·과제별 최소 점수/통과 수를 출력한다(별도 계산 없음).
- evaluator 버전은 `v2`로 구분한다(`CALIBRATION_EVALUATOR_VERSION`). task-set 버전은 w2 영역이라 손대지 않았다.

## 3. 안전성

- prompt/response/tool-log/diff/자격 계열은 허용 필드 목록에 없어 **중첩 표본에서도** 저장될 수 없다(`toRunRecord`가 표본·과제별로 동일하게 좁힌다).
- 보존 상한(`CALIBRATION_HISTORY_CAP` 20)과 prune 동작 그대로. 구버전 읽기(배열형 → samples 없음) 유지.
- 대표 표본: 집계 중앙값에 가장 가까운 표본(동률은 낮은 인덱스). 1회 실행은 `kind:'single'`.
- 실모델·실제공자 호출 없음. 테스트는 합성·주입 결과만 쓴다.

## 4. 회귀 추가 (테스트 이름 기준)

| 요구 | 테스트 |
| --- | --- |
| 첫 실패→두 성공 | multirun-store: 첫 실패→두 성공: 집계와 표본 근거가 함께 저장되고 재조회 후 같은 판정 |
| 첫 성공→두 실패 | multirun-store: 첫 성공→두 실패도 같은 방식으로 집계·보존된다 |
| 표본 순서 변경 | multirun-store: 표본 순서 변경은 집계를 바꾸지 않는다 |
| 중대 위반 | multirun-store: 중대 위반은 집계에 반영되고 위반 종류가 보존된다 |
| 단일 실행 | multirun-store: 단일 실행은 single 집계로 저장된다 |
| 구버전 읽기·보존 상한 | store.test: 구버전(배열형 tasks) 레코드는 samples 없이 읽히고 보존 상한은 유지된다 |
| 원문 비저장(중첩) | multirun-store: 중첩 표본에도 prompt/response/tool-log/diff/자격이 저장되지 않는다 |
| CLI 출력 = 저장 근거 | multirun-store: CLI 출력과 저장 레코드가 같은 집계 근거를 쓴다 |

## 5. 검증 (실측 exit)

- `node --import ./tests/harness-setup.mjs --import tsx --test "tests/insights-calibration-multirun-store.test.ts" "tests/insights-calibration-store.test.ts" "tests/insights-calibration-cli.test.ts"` → **23 pass / 0 fail, exit 0**
- `python3 scripts/validate-repo.py` → **PASS, exit 0**. `git diff --check` → **exit 0**. 작성 파일 모두 100줄 이하.
- `pnpm run typecheck`: **내 소유 파일 오류 0건**. 단 타 패널 진행분이 남아 있다(§7).

## 6. 독립 리뷰 지적 반영 (2026-10-20, w1 리뷰 불합격 후)

리뷰 문서 `docs/insights/calibration-storage-acceptance-review.md`의 2건을 닫았다.

**문제 1 — 포트 수준 허위 capable(MEDIUM) → 해결**
- `buildCalibrationRunRecord`가 표본 점수·통과수를 `run.evaluation`에서 가져오던 것을 **`taskResults` 재계산**으로 바꿨다
  (`computeTaskScore`·`isTaskPassed` → 표본 totalScore=과제점수 평균, passedTaskCount=통과 과제 수). evaluation 변조는 무시된다.
- 저장 경로(`assertRunRecord`→`assertRecordConsistency`)가 표본별 점수·통과수, 집계 3종(medScore·medPassed·hasCriticalViolation),
  totalScore, sampleStatus(1회 provisional/3회 stable), verdict를 **재계산과 대조해 불일치하면 거부**한다.
- verdict 판정은 scorer의 `determineVerdict`가 비공개라 `expectedVerdict` 미러를 두었고, **scorer 공개 API와 대조하는 테스트**로 분기를 막았다.
- 구버전(샘플 없음)은 **점수 일관성만** 검증하고 판정·표본 표기는 기록값을 유지한다(기존 행 폐기 방지, 리뷰 권고대로 문서화).
- 회귀: '위조 capable(실패 과제+totalScore 100)는 포트에서 거부된다', 'run.evaluation 변조는 무시되고 taskResults 재계산 결과가 저장된다',
  'expectedVerdict 미러는 scorer 공개 API와 일치한다'.

**문제 2 — 파손 violations_json이 목록 전체를 깨뜨림(MEDIUM-LOW) → 해결**
- `toRecord`가 `violations_json`을 **행 단위 try/catch**로 복구하고(비문자열 요소도 살균), 한 행이 목록 전체를 throw시키지 않는다.
- 회귀: '파손 violations_json 행은 목록 전체를 깨뜨리지 않는다(행 단위 복구)' — 임시 DB에 파손 행을 넣고 `listRuns`가 정상 반환함을 확인.

## 7. 미확인·남은 일 (내 범위 밖)

- `src/insights/calibration-runner.ts:46`·`calibration-sandbox.ts:81`·`calibration-verifier.ts:14` TS2322 — 새 env 계약
  (`buildSandboxEnv(extra, homeDir)`) 미연결분으로 w1/w2 소유 파일. 수정하지 않고 보고한다. (현재는 해소됐을 수 있음 — 마지막 재실행 기준 재확인 필요)
- `tests/insights-publish-recovery.test.ts` TS2322 2건 — 타 패널(#192 복구) 진행분. 내 소유 밖.
- `src/insights/plan-catalog.ts` 101줄 — 타 패널(미니맥스 catalog) 진행분으로 `validate-repo.py` 1건 FAIL. 수정하지 않고 보고한다.
- 미구현: 실제 provider 수집·DB 무결성 저장·가중치 재계산은 이번 단위 범위 밖. 보존 상한·prune·구버전 읽기는 유지했다.
- 커밋·push·PR 조작 없음. 원격 쓰기 없음. 재리뷰는 다른 워커가 맡는다.
