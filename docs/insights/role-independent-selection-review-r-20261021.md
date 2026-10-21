# 역할별 독립 선발 독립 리뷰 r (2026-10-21, #252)

- 이슈: [#252](https://github.com/usagi-ai-kr/yoroi/issues/252). 패킷 `yoroi-252-independent-selection-review-r`. 요구사항: [role-independent-selection-dispatch-20261021.md](role-independent-selection-dispatch-20261021.md).
- 대상: w1의 #252 변경. 소스 2개(`letter-role-selection.ts`, `letter-three-role.ts`)와 테스트 5개. 기준 HEAD `0086ca6`.
- 방법: `git diff` 원문 대조, 두 소스 전체 읽기, 테스트 단언 대조, 검증 두 번 실행(아래 A·B). 격리 스냅샷은 생략했다(패킷 요청).

## 판정

**PASS**(#252 범위: 선발 로직·Top7/Top15·테스트). **커밋·발행은 보류**한다. 현재 작업 트리에는 #253 WIP가 섞여 있어 check가 실패한다(검증 B·C). #252 커밋은 #252 파일만 스테이징해서 따로 검증해야 한다.

## 항목별 근거

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 상대 역할 교차 배제 제거 | PASS | `src/insights/letter-role-selection.ts:53-61`은 세 역할을 각각 `selectRole`로 호출한다. `oKeys·rKeys·oClosed·rClosed`는 남아 있지 않다(grep 확인) |
| 역할 내부 identityKey 중복만 제거 | PASS | `letter-role-selection.ts:40-50` `selectRole`의 `seen` 검사뿐이다 |
| 같은 클로즈드 모델 A 양쪽 1위 | PASS | `tests/insights-letter-role-selection.test.ts:11`, `tests/insights-letter-three-role.test.ts:24`, `tests/insights-letter-three-role-pipeline.test.ts` 5번(`shared-c`) |
| 오픈·클로즈드·미확인 공유 | PASS | 오픈 `three-role.test.ts:33`, 개방·폐쇄 혼합 `:69-78`, 미확인 `:59-67`(`unconfirmedModels` 포함). 파이프라인 6번(`shared`) |
| 다른 effort·경로 공유 | PASS | `three-role.test.ts:80-91`: `m-high`·`m-low`(같은 기반 `m`)가 오케·리뷰어에 각각 공유된다 |
| 워커 독립 | PASS | `three-role.test.ts:42-48`, 파이프라인 7번. 워커 선발 본문은 옛 `selectWorker`와 같다 |
| Top7/Top15 독립·접두 일치 | PASS | `letter-three-role.ts:63` Top15는 독립 선발 결과의 앞 15개다. `three-role.test.ts:12-22`가 Top15 앞 7개 = Top7을 단언한다 |
| 점수·가중치 불변 | PASS | `letter-reviewer-policy.ts`와 `config/reviewer-policy.json`은 HEAD와 같다 |
| 리뷰어 정책·Free 표 불변 | PASS | `letter-markdown-free*.ts`와 `letter-markdown-tables.ts`는 HEAD와 같다 |
| publish 계약(#252 부분) | PASS | #252 diff에 발행 경로 변경이 없다. 파이프라인의 `combinations` 필드는 #253 변경이며 리뷰 범위 밖이다 |

## 검증

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| A. 12:40:50–12:41:17, #252 변경 + 파이프라인 미연결 | PASS | typecheck 0. node:test 1429/1429. BDD 45/45(635 steps). build 0. 로그 `tmp/yoroi-252-r-check.log` |
| B. 12:42:56–12:43:14, 현재 작업 트리 | FAIL(#253 파일) | typecheck 1: `tests/insights-mermaid.test.ts` TS2375 여러 건. 테스트 1440 중 실패 2건, 둘 다 #253 파일(`insights-mermaid.test.ts:1450` 라벨 이스케이프, `insights-team-combinations.test.ts:1728` 그리디 조합). #252 관련 테스트는 모두 통과. BDD 45/45. 로그 `tmp/yoroi-252-rr-test.log` |
| C. validate-repo(현재) | FAIL(#253 파일) | `ERROR: src/insights/letter-team-combinations.ts: 101 lines > 100`(미추적). #252 파일은 모두 100줄 이하 |
| D. diff-check(#252 파일) | PASS | `git diff --check` exit 0 |

## 비차단 메모

- **N1 테스트 공백**: 옛 9번 테스트(빈 identity key 건너뛰기)와 unknown→closed 단언이 사라졌다. 빈 키 건너뛰기는 지금 단언이 없다.
- **N2 이름**: `selectRolesAlternating`(`letter-role-selection.ts:53`)은 더 이상 교대하지 않는다. 외부 import 영향을 확인한 뒤 이름을 정리하는 편이 좋다.
- **N3 주석 잔존**: `letter-three-role-pipeline.ts:34`의 "컷·MECE 할당 전"은 교대 MECE 흔적이다. 정리 목록에서 빠졌다.
- **N4 순서 의존**: 8~15위는 입력 순서를 따른다. 옛 댓글 extras는 점수로 다시 정렬했다. 상류 목록이 점수 내림차순이라는 전제에 기댄다. 이 전제는 테스트로 고정되어 있지 않다.

## 커밋·발행 게이트

- **#252 커밋 스테이징(7개)**: `src/insights/letter-role-selection.ts`, `src/insights/letter-three-role.ts`, `tests/insights-letter-role-selection.test.ts`, `tests/insights-letter-three-role.test.ts`, `tests/insights-letter-three-role-pipeline.test.ts`, `tests/insights-reviewer-comment-contract.test.ts`, `tests/insights-reviewer-composition.test.ts`. w1 문서 `docs/insights/role-independent-selection-20261021.md`를 더한다.
- **제외(#253 WIP)**: `src/insights/letter-three-role-pipeline.ts`, `src/insights/letter-three-role-body.ts`, `src/insights/letter-mermaid.ts`, `src/insights/letter-team-combinations.ts`, `config/open-weight-models.json`, `tests/insights-mermaid.test.ts`, `tests/insights-team-combinations.test.ts`, `docs/insights/team-combinations-impact-20261021.md`.
- 현재 작업 트리 기준 발행은 하지 않는다. 발행 전에 #252 파일만으로 `pnpm run check`와 validate-repo를 다시 돌려야 한다.

## 준수

코드·테스트·점수 가중치·리뷰어 정책을 바꾸지 않았다. 외부 쓰기, 재발행, 커밋, push를 하지 않았다. 산출은 이 소유 문서, report JSON, `tmp/`의 로그뿐이다.
