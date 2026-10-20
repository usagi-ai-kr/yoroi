# Free 매칭·리뷰어 테이블 독립 리뷰 (2026-10-21, w3)

- 범위: w1 A/B 구현(`tmp/yoroi-free-matching-reviewer-table-report.json`) + w3 D 배선의 실제 diff 대조. 읽기 전용 리뷰(소스 수정 없음).
- 판정: **PASS (D 교정 후)** — 교정 전 BLOCK 2건은 아래 §3에 교정 반영.

## 1. A(검증 Free 별칭 매칭) — PASS
- `src/insights/model-aliases.ts` 의 검증 규칙 3건 추가: `deepseek-v4-1-flash-free`·`glm-5-3-flash-free`·`mimo-v2-6-flash-free` → AA base id.
  각 규칙에 `basis`(공식 Free 목록 등재 + AA intel id 일치)·`checkedOn: 2026-10-20`·`sourceUrl`(공식 console 문서) 이 붙어 있다 ✓ → 근거 없는 별칭 아님 ✓.
- 기존 `minimax-m3-1-flash-free` 규칙 유지 ✓(동작 보존). 미확인 `-free` id 를 무료로 승격하는 규칙 없음 ✓.
- 검증: `tests/insights-free-matching-regression.test.ts` + w1 RED 테스트 `tests/insights-free-reviewer-integration-review.test.ts` 통과 ✓.

## 2. B(Free 리뷰어 표시 인터페이스) — PASS
- `FreeReviewerEntry { modelId, score, passed, isPareto? }` 를 `letter-markdown-free-sort.ts` 가 export ✓, `MarkdownLetterInput/Data` 로 전달 ✓,
  `renderFreeSectionMarkdown` 의 끝 인자(기존 인자 보존) ✓.
- `freeReviewer` 미지정(undefined)이면 **기존 2역할 표 그대로** ✓(테스트·구현 확인). 비어 있으면 3열 표 + 리뷰어 칸 '-' ✓.
- 점수 생성 없음: 렌더는 전달된 `score` 를 그리고, 없는 칸은 '-' ✓(테스트 '다른 모델 점수를 빌려오지 않는다' 통과).
- Free 행 제약: reviewer 병합은 **검증된 Free 행에만** 되고, 모르는 id 로 새 행을 만들지 않는다 ✓(w1 sorter 변경 확인).
- 헤더: 리뷰어 3열 변형이 `FREE_TABLE_HEADERS` 에 포함되어 가드가 허용 ✓(`letter-free-guard.ts` 는 **변경 없음** — Free guard 소스 변경 없음 확인 ✓).

## 3. D(w3 배선) — 교정 반영, 판정은 w1 최종 리뷰로
w1 리뷰(`docs/insights/free-wiring-independent-review-20261021.md`) BLOCK 2건을 직접 교정:
1. **접근판정 resolver 불일치** → `insights-reviewer-candidates.ts` 가 accessibleRecords(catalog `-free` id)와 variants base(AA 원형)를
   **동일 resolver(`resolveFreeModelId`)** 로 canonical 비교 ✓. (교정 전: Free '-free' 모델이 'inaccessible-catalog' 로 탈락 ✗)
2. **selection.reviewer.all 사용** → pipeline 출력에 `reviewerPool`(컷·MECE 할당 전 전체 eligible reviewer, readonly 메타데이터)을 추가
   (`letter-three-role-pipeline.ts`) → helper 는 **producer 의 전체 reviewer 만** 소비(selection/top15 fallback 제거) ✓.
3. **exact official Free ID join** → `freeReviewerEntries` 가 AA base → 공식 Free ID(`-free` 포함)로 매핑해 `modelId` 로 출력 ✓ → Free 행 id 와 정확히 일치 ✓.
   미검증·유료·미지 id 는 제외 ✓, 점수 없는 후보는 제외(생성 금지) ✓.
- 가중치·순위·MECE· effort 정책 변경 없음 ✓(파레토 플래그·점수 산출 경로 불변).
- 검증: w1 RED 테스트 + 신규 wiring/publish 테스트 + reviewer 계열 33/33 통과 ✓.
- **D 배선 자체의 PASS/BLOCK 최종 판정은 w1(`tmp/yoroi-final-free-wiring-review-packet.json`)이 한다 — 스스로 PASS 판정하지 않음** ✓.

## 3-1. 최종 확인(실측, 2026-10-21 w3)

- **unknown reviewer 가 새 행을 만들지 않음** ✓ — `freeRowsFrom` 의 reviewer 병합은 `rows.get(id) ?? rows.get(id.replace(/-free$/,''))` 로
  **기존 행에만** 붙는다(미존재 id 는 skip) ✓. w1 회귀 `'-free 리뷰어 근거는 base형 행에 합쳐진다'` 통과 ✓.
- **reviewer-only 근거는 verified unmeasured Free 행에 결합 가능** ✓ — 미측정 행이 reviewer 병합보다 먼저 `rows` 에 들어가므로 결합 가능 ✓
  (미측정 verified Free 행이 없을 때만 결합 대상이 없어 '-' 로 남음 ✓).
- **실측 composition 경로** — Free 3역할 표에서 리뷰어 칸이 실제 값으로 채워짐 ✓:
  `| minimax-m3-1-flash | ✓ 68.0 | ✓ 1.00 | ✓ 50.0 | 90.0 | ✓ | ✓ | 👍 파레토 · effort default |`
  (리뷰어 점수 = 리뷰어 자체 3차원 가중합(0~1) 스케일 — 역할 점수(0~100)와 스케일이 다르다 ✓).
- **2역할·공식·출처 보존** ✓ — 3역할 비활성 시 기존 2열 Free 표·Zen/Go 출처 각주·AA 지수 열 그대로 ✓(Free guard 소스 변경 없음 ✓).
- **안내(guide) 최신 판정** — `docs/insights/three-role-legend-independent-review-20261021.md` 참조 ✓.

## 4. 남은 사항
- `passed:true` 고정(증거 존재 전제)은 w1 지적대로 유지 — 점수 문자열이 근거 존재를 전제한다 ✓(근거 없으면 후보 제외 ✓).
- 리뷰어 점수 스케일(0~1) vs 역할 점수(0~100) 차이는 사용자에게 혼동 소지 → 문서/안내로 명시 필요(안내 문구는 w1 소유) → 보고만 ✓.
- 전체 `pnpm run check` 는 w1 최종 리뷰 뒤 1회(지금은 미실행) ✓.
