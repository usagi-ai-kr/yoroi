# 점수 소수점 두 자리 재리뷰 r (2026-10-21, #249)

- 이슈: [#249](https://github.com/usagi-ai-kr/yoroi/issues/249). 패킷 `yoroi-249-score-decimals-rereview-r`. 이전 리뷰: [score-decimals-review-r-20261021.md](score-decimals-review-r-20261021.md)(BLOCK B1).
- 대상: w1 수정의 미커밋 변경. 소스 4개(`letter-markdown-free-sort.ts`·`letter-top10-unified.ts`·`letter-top10-legend.ts`·`letter-three-role-render.ts`)와 테스트 10개. 기준 HEAD `6210164`.
- 방법: `git diff` 원문 대조, 검증 명령 재실행(백그라운드), 프로덕션과 같은 필드로 Free 출력 프로브(`tmp/yoroi-249-rr-probe.ts`). 격리 스냅샷은 생략했다(요청 반영).

## 판정

**PASS**. 이전 B1(Free 👍·정렬이 2자리 표시 문자열에 종속)이 해소됐다. 계산·순위·파레토 규칙은 바뀌지 않았다. 비차단 메모 4건은 아래에 남긴다.

## B1 해소 근거

| 확인 | 결과 | 근거 |
| --- | --- | --- |
| 1자리 비교 키 생성 | PASS | `letter-top10-unified.ts:47` `scoreKey = Number(cal.toFixed(1))`. 옛 `scoreText`와 같은 숫자 |
| 2자리 표시 유지 | PASS | `letter-top10-unified.ts:47` `scoreText = cal.toFixed(2)` |
| Free 별표 판정 | PASS | `letter-markdown-free-sort.ts:29` `starsOf`가 `e.scoreKey ?? parsedScore(...)`를 씀 |
| Free 정렬 키 | PASS | `letter-markdown-free-sort.ts:46` `sortScore: entry.scoreKey`. `:83` `cellKey`가 명시 키를 우선. 리뷰어 칸은 기존 2자리 유지 |
| 80.46/80.54 회귀 | PASS | 프로브: 입력 순서와 무관하게 `m-a:pareto=true:score=80.46 \| m-b:pareto=true:score=80.54`. 신규 회귀 테스트 `tests/insights-free-reviewer-table.test.ts`(파일 끝) |

## 항목별 근거

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 2자리 표시(역할 표·Top15·Free·요약) | PASS | 2역할 표 `letter-markdown-tables.ts:17`이 `scoreText`를 씀. 3역할 `letter-three-role-render.ts:45` `toFixed(2)`. Free 칸 `letter-markdown-free-sort.ts:46`. 요약 선두 `letter-top10-legend.ts:41` |
| 가산 +N.NN | PASS | `letter-top10-legend.ts:39` `toFixed(2)`. 테스트 `+3.74` |
| 1자리 점수 표기 잔존 | PASS(비점수만) | `letter-top10-unified.ts:42·44`의 변형 값·AA 지수는 스코어가 아님. `letter-reviewer-policy.ts:51`은 계산 반올림이고 표시는 2자리. `letter-markdown-format.ts:48`은 가중치 % |
| `-`·`✗` 미채움 | PASS | `letter-top10-unified.ts:47` 비유한 값 → `'-'`, `scoreKey` 미정의. `letter-three-role-render.ts:45` 비숫자 → `'-'`. `✗` 셀 불변 |
| 원시 점수·순위·가중치·후보 수 | PASS | `rawScore` 유지. 계산·가중치·후보 선별 diff 없음(`scoreKey` 필드 추가뿐) |
| 파레토 규칙 | PASS | 2역할 `isPareto: g.isPareto` 불변. Free 별표는 같은 규칙을 1자리 키에 적용 |
| 3역할 선별 순서 | PASS(조건부) | `letter-three-role.ts:63` 안정 정렬 키는 `insights-three-role.ts:30`의 `Number(scoreText)`(2자리). 점수가 순위에 따라 단조 감소하면 순서 불변. 임계 비교 없음 |

## 검증 결과

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| typecheck | PASS | `tmp/yoroi-249-rr-check.log` `TYPECHECK_EXIT=0` |
| node:test | PASS 1435/1435 | 같은 로그: `ℹ tests 1435` / `pass 1435` / `fail 0` |
| BDD | PASS 45/45 | 같은 로그: `45 scenarios (45 passed)`, `635 steps` |
| build | PASS | `BUILD_EXIT=0` (tmp outDir) |
| validate-repo | 최종 실행 결과는 아래 | `tmp/yoroi-249-rr-validate.log` |
| diff-check | PASS | `git diff --check` exit 0 |
| 100줄 이하 | PASS | 이 문서와 report JSON 모두 100줄 이하 |

## 비차단 메모

- **M1 테스트 불변식**: `tests/insights-top10-unified.test.ts:41`의 신규 단언은 `Number(scoreText).toFixed(1) === scoreKey.toFixed(1)`로, 2자리 → 1자리 이중 반올림에 기댄다. 엣지 값에서는 실패할 수 있다. 프로덕션 `scoreKey`는 직접 반올림이라 정확하다. 원 값 기준 비교로 바꾸는 편이 안전하다.
- **M2 무관한 재배치**: `letter-top10-unified.ts`의 `vs`·`openrouterRankText` 두 줄이 #249와 무관하게 한 줄로 합쳐졌다. 동작 변화는 없다.
- **M3 BDD 공백**: `features/insights.feature`는 미변경이고 스코어 문구 단언이 없다. BDD 45/45는 이 변경을 검증하지 않는다.
- **M4 범위 밖 변경**: `docs/orchestration.md`는 #249가 아니다. 커밋에서 제외해야 한다.

## 재발행 위험

- 본문·댓글·Free 칸·요약 선두·가산의 자리수만 바뀐다. 값·순위·파레토·순서는 pre-#249와 같다. 1자리 비교 키가 옛 표시값과 같은 숫자이기 때문이다.
- 커밋·발행 게이트: #249 파일만 명시 경로로 스테이징한다(소스 4개, 테스트 10개). `docs/orchestration.md`와 다른 작업의 문서는 제외한다.
- 이번 리뷰에서 발행은 하지 않았다.

## 준수

코드·테스트·계산·순위·파레토 규칙을 바꾸지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그와 프로브뿐이다.
