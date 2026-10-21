# 리뷰어 파레토 계산·전달 결과 (2026-10-21, w3 · C 단위)

- 범위: **C(리뷰어 파레토)만 구현.** 가중치·순위·기준·ban·effort 정책 변경 없음, renderer 미수정, Free 렌더러 파일 미수정, 커밋 안 함.
- 소유 파일: `src/insights/letter-reviewer-pareto.ts`(신규) · `src/insights/letter-reviewer-candidates.ts` ·
  `src/composition/insights-reviewer-candidates.ts` · `tests/insights-reviewer-pareto.test.ts`(신규) · `tests/insights-reviewer-composition.test.ts`

## 1. 구현 내용

1. **원시 비용 확보** — `ReviewerCandidate` 에 `cost` 추가. 값은 대표 variant 의 `effectiveCost ?? blendedCost` **원값**
   (`letter-reviewer-candidates.ts` 의 `rawOf` 가 이미 그 원값을 계산하고 있었다 → 정규화 전 값을 그대로 보존).
   정규 `price` 는 역방향(저비용=높은값)이라 **비용 비교에 쓰지 않는다**.
2. **파레토 판정** — `src/insights/letter-reviewer-pareto.ts`
   - 두 축: `reviewer score` 높음 + `cost` 낮음.
   - 지배 조건: 다른 후보가 `score >=` 이고 `cost <=` 이며 **한쪽이 strict** → 지배. 동점(양쪽 equal)은 **둘 다 비지배**.
   - `score`·`cost` 결측 → **비파레토**(추정 금지). 결측 비용 후보는 다른 후보의 비교 대상에서 빠진다(추정 아님).
   - 입력 순서 무관(대칭 규칙) — 회귀 테스트로 고정.
3. **계산 위치** — `buildReviewerCandidates`(composition)에서 **cap 적용 → 정책 점수 → base dedupe 이후**, 전체 적격 reviewer 후보(컷 전)에 대해 계산.
   `reviewer` 반환 배열이 `isPareto` 를携带 → 파이프라인 `RoleCandidate`(인덱스 시그니처) → 선택 → 렌더로 전달된다(렌더는 이미 `entry.isPareto` 지원 ✓).
4. **점수·순위 불변** — 파레토는 표기용 플래그일 뿐이며 후보 순서·점수 계산·가중치·MECE 배정을 건드리지 않는다.

## 2. 검증

- 신규 `tests/insights-reviewer-pareto.test.ts` 7건: 비지배/지배, 한 축만 우위(부분 지배 아님), 동점, 비용 결측, 점수 결측, 입력 순서 불변, 원본 값 보존.
- `tests/insights-reviewer-composition.test.ts` 에 파레토 전달 단언 추가(비지배 존재 + 지배 존재).
- 집중: 파레토+composition **16/16 통과**. 합성 재현(읽기 전용 스크립트): reviewer 3명 → `a(score 1.0, cost 1.25)=pareto`, `b(0.6, 10.0)=지배`, `c(0.5, 0.25)=pareto`.
- `pnpm run typecheck`: **내 파일 오류 0**. 단 현재 트리는 w1 의 B 인터페이스 작업 중(`letter-markdown.ts` 의 `FreeReviewerEntry` export, `tests/insights-free-reviewer-table.test.ts`)으로 **타 파일 2건 오류**가 남아 있다 → 내 변경과 무관(소유 외 파일 미수정).
- 파일 100줄 이하: pareto 모듈 30 · candidates 67 · composition 97 · 테스트 55/99.
- `python3 scripts/validate-repo.py` · `git diff --check` (아래 검증 로그).

## 3. 한계

- 리뷰어 파레토의 두 축(가중합 score vs 원시 비용)은 **2역할 파레토(역할 점수 vs 혼합 단가)** 와 계산 대상이 다르다(가중합 vs 원시값).
  이 차이는 설계 근거가 있는 선택이며, 이전 진단서의 "원시 AA 컷/정규 price" 설명을 그대로 복사하지 않았다.
- 비용 결측 후보는 항상 비파레토다(관측 없음 → 비지배 아님을 추정하지 않음).
- 파레토 표기는 **3역할 표**에 한정(본문 2역할 표·Free 표는 기존 동작 그대로).

## 4. D(다음 배선 단위) 패킷 초안 — root 승인 계약 후 진행

- **목표**: B 인터페이스(FreeReviewerEntry) 완성 후, composition 이 `buildReviewerCandidates` 의 **전체 적격 reviewer** 를 사용해
  official Free 모델에 해당하는 score·isPareto 를 `FreeReviewerEntry` 로 만들어 Free 3역할 표에 전달한다.
- **소유 파일(예정)**: `src/composition/insights-three-role.ts`(freeReviewer 구성·주입),
  `src/composition/insights.ts`(레터 입력 전달), `src/insights/letter-markdown.ts`·`letter-markdown-free-sort.ts` 는 **B 소유(w1)** → 건드리지 않고 확장 요청만 한다.
- **완료 기준**: 3역할 활성일 때만 `freeReviewer` 주입(비활성 기존 출력 보존) · Free 표 3열(오케/리뷰어/워커) + review-only 근거 행 허용 ·
  Free 경로 체크·calibration 숨김·기존 셀 유지 · 본문/댓글 Top15·Free 까지 실제 CLI 경로 검증(`insights`→`composition` 역의존 금지) · 점수·순위 불변.
- **검증**: focused + `pnpm run check` 1회(통합 최종 tree) · `python3 scripts/validate-repo.py` · `git diff --check` · 파일 100줄.
- **금지**: 점수 생성·추정, 모델별 하드코드, 기준 완화, Free 실측, push.
