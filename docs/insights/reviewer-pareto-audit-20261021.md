# 리뷰어 파레토 공백 진단 (2026-10-21, w3)

- 범위: **진단만.** 파레토 계산·정책 변경 없음, renderer(`letter-three-role-render.ts`)는 w1 소유 → 읽기 전용.
- 근거 코드 위치와 판단, 다음 수정 패킷 초안.

## 1. 결론 (먼저)

**계산·전달 누락(구현 공백)이다.** 기준 문제(빈 칸이 맞는 설계)가 아니다.
파레토 표시는 3역할 표가 공유하는 계약이고, 리뷰어 경로에서만 값이 끝까지 전달되지 않는다.

## 2. 근거 경로

1. **오케스트레이터·워커** — `buildThreeRole`(`src/composition/insights-three-role.ts:22-36`)이
   `computeRoleTop10` 의 최종 ranked entries 를 후보로 쓰고, `fromRanked` 가 `isPareto: e.isPareto` 를 그대로 옮긴다.
   값의 출처는 `letter-top10-score.ts:94`(오케)·`letter-top10-worker.ts:72-81`(워커 `paretoGroups`):
   `cost !== undefined && !indexMissing && !dominated` — 다른 그룹이 **비용은 더 낮고(≤) 값은 더 높으며(≥)**(strict 부등호로 한쪽만)면 지배로 판정.
2. **리뷰어** — `buildReviewerCandidates`(`src/composition/insights-reviewer-candidates.ts`)→
   `toReviewerCandidates`(`src/insights/letter-reviewer-candidates.ts:56-60`)가 만드는 `ReviewerCandidate` 는
   `modelId·baseModelId·effort·value·performance·speed·price` **만** 갖고 `isPareto` 필드가 없다.
   → 리뷰어 후보는 처음부터 파레토 판정을 받지 않고, 파이프라인을 거쳐 렌더로도 전달될 값이 없다.
3. **렌더** — `letter-three-role-render.ts:13·58` 은 `entry.isPareto === true` 면 `PARETO_MARK` 를 찍는다.
   즉 **렌더는 준비돼 있고 입력만 비어 있다**(renderer 수정 불필요).
4. **전달 가능성** — `RoleCandidate`(`letter-role-selection.ts:3-7`)가 인덱스 시그니처를 갖고
   `SelectedRoleCandidate = T & {...}` 이므로, 후보에 `isPareto` 가 붙으면 선택·순위 단계에서 그대로 살아남는다(추가 타입 변경 불필요).

## 3. 판단 근거(기준 문제로 볼 수 없는 이유)

- 파레토 표시는 2역할 표(`letter-markdown-tables.ts:15`)와 3역할 표가 **같은 열·같은 기호**를 쓴다.
  2역할 표는 오케·워커 행에 값이 찍히므로, 리뷰어만 항상 빈 칸이면 "표기 계약"이 아니라 "입력 전달"이 끊긴 지점이다.
- 리뷰어 후보는 `performance·speed·price` 3차원 정규값과 가중합 `score` 를 이미 갖고 있어 **비교 기준 자체는 준비**돼 있다.
  남은 것은 (a) 파레토 판정 추가, (b) 그 값을 후보에 붙여 파이프라인·렌더로 넘기는 일뿐이다.
- 단, **리뷰어의 지배 기준(무엇과 비교하는가)**은 2역할 표와 동일할 수 없다. 2역할 표는 "역할 점수 ↑ vs 혼합 단가 ↓"이고,
  리뷰어 점수는 3차원 가중합이다. → 기준은 **다음 패킷에서 명시적으로 정해야 하며, 임의 완화로 처리하지 않는다**.

## 4. 다음 수정 패킷 초안 (파레토 기준 확정 필요)

- **목표**: 리뷰어 3역할 표의 파레토 기호가 실제 비지배 후보에만 찍히도록 한다(계산 누락 제거).
- **기준(결정 필요)**: 리뷰어 지배 판정 규칙. 권고안 — 리뷰어 후보 집합 안에서
  "가중합 score 가 더 낮거나(≤) 같고 정규 price 가 더 높거나(≥) 같으면(부등호 한쪽만 strict) 지배" 를 쓰고,
  정규 price 가 결측인 후보는 `paretoGroups` 와 동일하게 판정에서 제외한다. **사용자 확정 전에는 구현하지 않는다.**
- **소유 파일(후보)**: `src/composition/insights-reviewer-candidates.ts`(리뷰어 파레토 계산+전달),
  `src/composition/insights-three-role.ts`(명시 reviewer 경로에서도 호출자 후보의 isPareto 보존 확인),
  `src/insights/letter-reviewer-candidates.ts`(후보 타입에 isPareto 필드 명시) — **renderer 는 w1 소유라 수정 대상 아님**,
  테스트: `tests/insights-reviewer-composition.test.ts`(계산 규칙·지배 제외), `tests/insights-three-role-output.test.ts`(표에 기호 표시·비지배 후보만).
- **검증**: `pnpm run check`, `python3 scripts/validate-repo.py`, `git diff --check` + 리뷰어 파레토 단위 테스트.
- **금지**: 기준 임의 완화(다른 모델의 파레토를 늘리거나 줄이는 것), 렌더러 수정, 점수·순위 정책 변경.

## 5. 참고

- 리뷰어 후보의 base dedupe(cap 적용 후 최고 점수 1개/기준)는 파레토 계산 **이전**에 일어난다.
  파레토는 dedupe 후 남은 후보 집합에서 판정할지, dedupe 전 전체 후보에서 판정할지 명시해야 한다(권고: dedupe 후 — 표에 실제로 나오는 행이 기준).
- 현 상태에서 리뷰어 파레토 칸은 "정확한 비지배 판정"이 아니라 **미계산**이므로, 사용자에게 "파레토 없음"으로 읽힌다.
