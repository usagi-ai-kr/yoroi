# Free 리뷰어 배선 결과 (2026-10-21, w3 · D 단위)

- 범위: D 배선(3역할 활성 시 Free 3열 표에 리뷰어 근거). 점수·가중치·순위·기준 변경 없음, 커밋 안 함, 전체 check 미실행(w1 최종 리뷰 뒤 1회).

## 1. 구현

1. **producer 보존** — `letter-three-role-pipeline.ts` 의 `ThreeRolePipelineOutput` 에 readonly `reviewerPool`
   (컷·MECE 할당 전 전체 eligible reviewer, 가중치 적용 후) 을 추가 ✓. `composition/insights-three-role.ts` 가 producer 의 전체 reviewer 를 그대로 전달 ✓.
2. **소비** — `composition/insights-free-reviewer.ts` 의 `freeReviewerFor` 는 **producer 의 전체 reviewer 만** 소비
   (selection/top15 fallback 제거 ✓ → Free 점수가 Top15 밖·다른 역할 배정분에서도 유지 ✓).
3. **join 키** — `freeReviewerEntries` 는 AA base id → **공식 Free ID(`-free` 포함)** 로 매핑해 `modelId` 로 출력 ✓ → Free 행 id 와 정확히 일치 ✓.
   미검증·유료·미지 id 는 제외 ✓, 점수 없는 후보는 제외(근거 없는 점수 금지) ✓, `isPareto` 는 전달값 그대로 ✓.
4. **접근판정 정정** — `composition/insights-reviewer-candidates.ts` 가 accessibleRecords(catalog `-free` id)와 variants base(AA 원형)를
   **동일 resolver(`resolveFreeModelId`)** 로 canonical 비교 ✓ → 교정 전 Free '-free' 모델이 'inaccessible-catalog' 로 탈락하던 문제 해결 ✓.
5. **전달 경로** — composition(`insights.ts`)이 top10 에 `freeReviewer` 를 실어 보냄 → publish·once `--markdown` 이 `...top10` spread 로 그대로 전달 ✓
   (CLI 파일 수정 0 ✓). 3역할 비활성이면 `undefined` → 기존 2역할 Free 표 유지 ✓.
6. **파일 분리** — 100줄에 가까운 composition 파일을 건드리지 않고 신규 helper(`insights-free-reviewer.ts`)로 분리 ✓.

## 2. 검증

- w1 RED 회귀 `tests/insights-free-reviewer-integration-review.test.ts` **통과**(기대값 변경 없음) ✓
- 신규 `tests/insights-free-reviewer-wiring.test.ts`(4건) · `tests/insights-free-reviewer-publish.test.ts`(2건) 통과 ✓
- reviewer 계열(파레토·composition·pipeline) 포함 집중 **43/43 통과**(2026-10-21 w3 최종 단위 기준) ✓
- `pnpm run typecheck` 오류 0건 · 파일 100줄 이하(`insights-reviewer-candidates.ts` 102→100줄 정리) ✓
  · `python3 scripts/validate-repo.py` **실제 exit 0** (PASS: 981 files) ✓ · `git diff --check` 통과 ✓
- **실측(합성 fixture, composition 경로)**: Free 3역할 표의 리뷰어 칸이 실제 점수로 채워짐 ✓ —
  `| minimax-m3-1-flash | ✓ 68.0 | ✓ 1.00 | ✓ 50.0 | 90.0 | ✓ | ✓ | 👍 파레토 · effort default |`
  (행 내부 id 는 공식 Free ID `-free` ✓, 표시만 base 형태 ✓ → exact join 성립 ✓)
- **helper 공개 API 기본호환** ✓: 빈 카탈로그 → 빈 결과 ✓, 카탈로그 없음(`undefined`) → `[]`/`undefined` 반환(예외 없음) ✓,
  점수 없는 후보 → 제외 ✓, 미검증·유료·미지 id → 제외 ✓, 3역할 비활성·producer reviewer 없음 → `undefined`(2역할 출력 유지) ✓.
- **D 배선의 최종 PASS/BLOCK 판정은 w1 최종 리뷰가 담당** — 이 문서는 자체 판정이 아니다 ✓.

## 3. 남은 위험·한계

- `passed:true` 는 점수 문자열 존재를 전제한다(근거 없으면 후보 제외) ✓ — w1 지적대로 유지.
- 리뷰어 점수는 리뷰어 자체 지표(3차원 가중합, 0~1 스케일)이며 역할 점수(0~100)와 스케일이 다르다 → Free 표에서 다른 역할과 나란히 볼 때 해석 주의(문서화 필요).
- Free 3열 표는 3역할 활성 시에만 나간다(off면 2열) ✓ — 본문 2역할 표는 그대로 ✓.
- 전체 `pnpm run check` 미실행(다음 최종 단위 1회) ✓ · 커밋 없음 ✓.
