# 메신저 구현 독립 리뷰 (2026-10-21, w3 · #227)

- 범위: U1·U2·U2b·U3a·U3a-b·U3a-ii + #230 변경에 대한 **읽기 전용 독립 리뷰**(코드·테스트 미변경 ✓).
  근거는 자기신고 보고서가 아니라 **실제 git diff·실행 결과** ✓.
- **종합 판정: PASS** (BLOCK 0건) — 단, **U2 계약과의 편차 1건**(전역 OptimalZoneRole 확장 보류)과 **발행 미사용 경계**를 명시 ✓.

## 1. 가중치·임계·하한 일관성

| 항목 | 요구 | 구현 위치 | 확인 |
| --- | --- | --- | --- |
| 메신저 가중치 | .20/.10/.30/.40 | `config/score-weights.json` ✓ · `SCORE_WEIGHTS_DEFAULTS` ✓ | config↔코드 일치 ✓ 합=1 ✓ |
| 존 임계 | .60 | `MESSENGER_THRESHOLD = 0.60` (`letter-top10-score-policy.ts:35`) | 워커 `OPTIMAL_ZONE_THRESHOLDS.worker = 0.60` 와 동일 ✓ |
| priceMissing | .99 | `score.ts` — `role === 'messenger' ? PRICE_MISSING_VALUE : …` (0.99) ✓ | 워커와 동일 ✓ |
| intel 하한 | 33 | `WORKER_INTEL_FLOOR = 33` + `workerLike` 분기 ✓ | 워커 경로 공유 ✓ |
| 데이터 배관 | 워커와 동일 | `isWorkerLike` (`policy.ts:31`) 로 `collect/capWorkerPerf/가산/속도/가격` 분기 통일 ✓ | 워커·오케 경로 불변 ✓ |
| 역할 소스 | 워커와 동일 | `srcRole = role === 'messenger' ? 'worker' : role` + `ROLE_SOURCES[srcRole]` ✓ | 언소유 호출은 worker 매핑으로 바이트 동일 ✓ |

## 2. 기존 오케·워커 불변

- `srcRole` 매핑으로 오케·워커 계산 경로 분기 자체가 바뀌지 않음 ✓ (`letter-top10-score.ts` 전체 diff 검토 ✓).
- 가중치 파일은 messenger 항목 **추가만** ✓ (오케 .75/0/.10/.15 · 워커 .30/.20/.10/.40 그대로 ✓).
- `banSetFor`(messaging→워커 밴 ✓) · `applyMixedPriceCap`(isWorkerLike ✓) · `buildList`(역할 타입 확장만 ✓) 모두 오케·워커 경로 불변 ✓.
- **검증**: `tests/insights-top10-score.test.ts`(신규 2건: 속도 우위 역전 · 결측/하한/cap/동점/미확인/밴) ✓ ·
  `insights-c-policy`·`insights-score-weights`·`insights-dimension-contract`·`insights-top10-source-policy` 통과 ✓ ·
  전체 check **단위 1433/1433** ✓ · BDD **45 시나리오/635 스텝 전부 통과** ✓ · typecheck·build 통과(`EXIT=0` ✓).

## 3. 4역할 섹션·MECE 밖

- 순서 `o → r → w → m` ✓ (`THREE_ROLE_ORDER` ✓), 라벨 `✉️ 메신저` ✓, 워커 라벨 `🛠️ 워커` ✓(`THREE_ROLE_TITLES` ✓).
- **MECE 밖**: `selectRolesAlternating` 는 o/r/w 만 배정 ✓ · 메신저는 독립 점수 정렬 슬라이스 ✓(워커와 같은 모델 허용 ✓) ·
  `top7`/`top15` 댓글 맵은 o/r/w 유지 ✓ (U3a 계약 ✓).
- **메신저 없으면 3섹션** ✓ — `threeRoleBlock` 은 `sections.messenger !== undefined` 일 때만 추가 ✓ ·
  파이프라인은 `mAll.length > 0` 일 때만 `sections.messenger` 생성 ✓ · 렌더는 필터로 생략 ✓.
- 2역할 경로(3역할 off) 무변경 ✓ — 2역할 표 제목은 `letter-top10-legend.ts` 불변 ✓ · `hasLegacyRoleBlocks` 상수 `## 🛠️ 워커·메신저` 유지 ✓(신 3역할 머리 `## 🛠️ 워커`와 불일치 ✓ 오인식 없음 ✓).

## 4. Free 표 4역할 열

- 열 추가 ✓: `FreeRow.messenger` ✓ · `freeMarkdownRowsWithMessenger` ✓ · 헤더 2종 신규(`MESSENGER_*_HEADER`) ✓ ·
  `FREE_TABLE_HEADERS` 에 allow-list 추가 ✓ → **가드(`letter-free-guard.ts`) 소스 무변경으로도 4열 머리 허용** ✓.
- **messengerPool exact id** ✓: `freeMessengerFor` 는 selection 컷이 아닌 **producer 전체 eligible** `messengerPool` 를 소비 ✓ ·
  후보 id → base 해석 → `freeIdByBase`(free 티어 + **verified** 모델만) 로 정확히 매칭 ✓ → 출력 id 는 **공식 Free ID** ✓.
- **verified gate** ✓: 미검증·유료·미지 id 는 `byBase` 에 없어 제외 ✓.
- **미확인 제외** ✓: 점수 없는 후보 제외(`Number.isFinite`) ✓ · `freeRowsFrom` 은 기존 행에만 병합(신행 생성 금지) ✓.
- **점수 생성 없음** ✓: 전달 점수만 표기(`toFixed(2)`) ✓ · 근거 없는 칸은 `✗`/`-` ✓.
- 3역할 표(리뷰어) 출력 불변 ✓ — `freeMessenger === undefined` 면 기존 3역할 머리·행 ✓ (`letter-markdown-free.ts:71` 분기 ✓).
- Free 행 정렬: 메신저 티어 추가 ✓ · 메신저 미사용 시 비교값이 0 → 기존 순서 불변 ✓.

## 5. 발행 경계 (U3b 미구현 확인)

- `letter-parts.ts`·`insights-publish.ts`·`insights-publish-recovery.ts`·`insights-cli.ts`·워크플로 **변경 0건** ✓
  → 댓글 3개 계약(`comments.length !== 3` ✓)·`freeSectionProblem(comments[2])` ✓·복구·중복 게이트·dry-run 모두 현행 ✓.
- **경계**: 현재 트리(4역할 본문 + Free 4열)는 **발행에 사용하면 안 된다** ✓ — 본문은 4섹션인데 댓글·Free 인덱스는 3댓글로 고정 ✗
  → U3b(댓글 4번째 + publish 계약) 완료 전 **발행 금지** ✓ (분석 문서 `messenger-comments-impact-20261021.md` 참조 ✓).

## 6. 기타 확인

- 100줄 제한: `python3 scripts/validate-repo.py` → 위반 0건 ✓ · `git diff --check` clean ✓.
- 비밀값: diff 전체 스캔에서 키·토큰·인증값 0건 ✓ (히트 2건은 상수·메트릭 문자열 문맥 ✓).
- 커밋·push·외부 쓰기 0건 ✓ (HEAD `9d2bc56` 유지 ✓ · 모든 구현이 워킹 트리 미커밋 ✓).
- 소유 외 파일 수정: 본 리뷰는 **문서 1건 신규만** ✓ (코드·테스트 0건 ✓).

## 7. 발견 사항·후속

1. **[편차·주의]** U2 계약은 `OptimalZoneRole` 에 messenger **원자적 추가**를 요구했으나 구현은 `RoleWithMessenger` + `srcRole` 매핑으로 전역 타입 확장을 **보류** ✓.
   출력 불변 보장에 유리하지만, 이후 `OptimalZoneRole` switch 를 만지는 단위에서 messenger 분기 누락 위험이 남음 ✓ → **후속 단위에서 재검토 권고** ✓.
2. **[경계·필수]** U3b(4번째 댓글 + publish 계약) 완료 전 발행 금지 ✓ (§5 ✓).
3. **[잔여]** 메신저 점수는 0~100 스케일 ✓ · Free 표 메신저 칸도 같은 값 ✓ → 역할 간 비교 표기 해석 안내 필요(문구는 w1 소유) ✓.
4. **[잔여]** U3b 구현 시 Free 评论 이동 여부(권고 B안: 마지막 댓글) 를 publish 계약과 함께 결정해야 함 ✓ (분석 문서 §3 ✓).
