# #267 DeepSeek O 기대 계산 독립 검증 + #266 WIP 리뷰 (r, 2026-10-21)

방법: 패킷 `yoroi-267-deepseek-expectation-review-r`. w3(#267)/w2(#266) 산출물과 무관하게,
tsx로 실제 코드 경로(`loadOpenWeightKeys ∪ verified Free ids → unionPool → buildTeamCombinations`)를
실행해 전수 탐색을 재계산했다. 점수 원본은 #265 레터 Top7(실제, 이슈 265 본문 직접 확인)이며
합성 fixture와 구분해 기록한다. 코드·점수·순위·레터는 변경하지 않았다.

## 1. 독립 재계산 결과 (실제 #265 값, 전수 탐색)

| 조합 | 슬롯 | 합산 | w3 일치 |
|---|---|---:|---|
| open-1+1+3 | O deepseek 62.94 · R muse 80.80 · W minimax 59.35 / mimo-flash 54.54 / glm-5-3 53.19 | 310.82 | ✓ |
| open-1+2 | O deepseek 62.94 · W minimax 59.35 / muse 55.98 | 178.27 | ✓ |
| 대안: DeepSeek→W | O mimo-pro 57.45 · R muse 80.80 · W deepseek+minimax+mimo-flash | 309.69 (−1.13) | ✓ |
| 대안: DeepSeek 제외 | O mimo-pro 57.45 · R muse 80.80 · W minimax+mimo-flash+glm-5-3 | 305.33 (−5.49) | ✓ |

- **DeepSeek이 O다(자연 합산 최대).** 사용자 기대와 일치 — 강제·가중치 없이 도달했다.
- DeepSeek R(73.90) > O(62.94)이지만 최대 R은 muse 80.80이라 R 자리를 muse가 차지한다.
  DeepSeek을 W로 밀면 muse는 여전히 R에 두 수 있지만 O가 deepseek(62.94)에서 mimo-pro(57.45)로 내려가고
  차선 작업자 교체(glm-5-3 53.19 → deepseek 57.55)로 이득(4.36)보다 손실(−5.49)이 커 −1.13이 된다.
- best-* 동일 산식: 72.95+80.80+69.60+64.40+59.35=347.10 / 72.95+69.60+64.40=206.95 ✓ (claude·gpt 값도 #265 Top7 실측).

## 2. MiniMax·Beam·Free fallback (실제 경로)

- MiniMax: R 69.20 < muse 80.80이라 두 조합 모두 W 슬롯(w·59.35). canonical로 Free 행(minimax-m3.1-free)과 같은 실체다.
- Beam: union W pool에 unmeasured로 등재되고, 측정 W가 충분해 결과에서 미선발(unmeasured=0).
  폴백은 base(best-*)의 `freeWorkerFallback`에서만 작동한다(union 콤보는 fallback 미사용). Beam 강제 시 257.63(산식 재확인 ✓).
- 신규 정책(워커 최소 1자리 verified Free) 기준선 비고: minimax·mimo-flash 2개가 이미 verified Free 접근이라
  **결과 불변 예상**(정확히 1슬롯 제한 시 301.74, Beam 강제 257.63 — w3 산식 재산출 대조로 재확인).

## 3. #266 WIP 독립 리뷰 (diff 직접 검증)

| 항목 | 판정 | 근거 |
|---|---|---|
| union 풀(오픈8 ∪ verified Free) | PASS | `unionIds = loadOpenWeightKeys() ∪ freeCatalogModelIds`, config 8 모델 확인 |
| canonical/effort 매칭 | PASS | `canonicalModelId` dedupe·`identityKey` 유지·effort 전달, 중복 금지 회귀 테스트 |
| 실제 카탈로그→상위 생성기 배선 | PASS | composition: verified Free catalog id ∪ fallback 전달(수정 1줄, 구조 보존) |
| O/R 측정만·W 미측정 허용 | PASS | `measuredOnly` + Beam W 전용, 테스트 회귀 3건 |
| 라벨·뱃지 · 차선 · 1+2 | PASS | '오픈 웨이트·Free'(8957e5), `runnersUp` roles, 1+2 리뷰어 슬롯·차선 없음 |
| 표/댓글/publish 계약 | PASS | Top7/Top15·Free 표·실사용 열·댓글 렌더러 diff 없음 |
| 검증 | PASS | check 로그 1464/1464·BDD 45/635·tsc EXIT=0, w1 fresh 재현(1464/1464·EXIT=0) 동일, validate-repo 0건, diff-check clean |

## 4. 발견 (모두 비차단)

1. w2 보고서 modified_files에 `tests/insights-letter-three-role-pipeline.test.ts(100줄) 갱신` 있다; 실제 diff는
   미변경이다. 보고서 문구 불일치(코드·검증품질에는 영향 없음, w1 지적과 동일 판정).
2. `unionPool`은 구 `freePolicyPool`과 달리 `free:true`를 부여하지 않는다 → open-* 슬롯에 🆓 미표기.
   union은 유료 오픈(Kimi 등)과 Free 혼재라 방향은 타당, 협약(라벨·뱃지·Free 표)에는 미영향.
   w1이 신규 Free 슬롯 정책 구현 시 표기 방식을 문서로 확정하면 재검토 대기.
3. w3(구 w4) 보고서 상단 조합 기술에 합성(fixture) 기준 R kimi-k3 문구가 실데이터 결과(R muse)와 섞여 있었다.
   문서 본문은 합성/실제 구분을 갱신했다(계산 기준: tsx + #265 Top7, 내 검증과 동일). 보고서 JSON에도 구분 표기를 권장.
4. 신규 확정 정책(워커 최소 1자리 verified Free)은 w1(p2)이 구현 진행 중 — 현재 WIP는 자연 최적 baseline이다.
   w1 완료 후: 정책 구현 형태(최소 1자리 보장, 나머지 자연), 결과 불변(기대), 표/댓글/publish 계약, 전체 check를 재검증한다.
5. 외부 쓰기 없음: #267 이슈 댓글은 r 검증 후 w3(p9) 작성 예정이라 대기 상태 — 본 검증이 그 조건을 충족시킨다.

## 5. 판정

- 요청 검증 범위(union 자연 합산 최대·DeepSeek O 검증·MiniMax/Beam/fallback·#266 WIP 배선·계약) = **PASS**.
- 차단 요소 없음. 최종 종결은 w1 신규 Free 슬롯 정책 구현 + 전체 check 후 재판정(기대: 결과 불변·계약 불변).
## 6. Free 슬롯 최종 리뷰 (w1 DELTA, 별도 패킷 yoroi-266-free-slot-final-review-r)

- 구현(`verifiedFreeKeys` 쿼터)을 composition 경로 입력(공식 카탈로그 대시형 id = `officialFreePlans`가
  canonicalFreeId로 산출하는 값)으로 재판정: **4조합 모두 워커 verified Free ≥1** 확인.
  best-1+1+3 347.10(W3 minimax) · best-1+2 **201.90**(haiku→minimax, 정책 예상치와 일치) ·
  open-1+1+3 310.82(GLM 5.3 유지, Beam 미등장) · open-1+2 178.27.
- 평가자 입력 규칙(w2 F5와 동일): Free id는 카탈로그 대시형(modelId)만 써야 한다. 점형 원문 id를
  그대로 키로 넣으면 쿼터가 측정 Free를 거부하고 미측정(big-pickle)으로 퇴화한다 — 제 eval 1차 재현
  결과 287.75·142.55는 이 입력 오류 산출이며 제품 결함이 아니다(w2 판정 수용·내 재현 정정).
- w3의 'best-1+2 206.95(No Free)'와 본 검증의 201.90은 상충이 아니다 — 무예약 입력(현재 src 그대로)과
  정책 적용(verifiedFreeKeys 활성)의 전/후 상태 차이로, w2 재현(/tmp/repro-266.mjs)과 w3 evidence
  (tmp/yoroi-266-letter-draft-w3-evidence.txt) 슬롯·수치 완전 일치로 동일입력 재확인됐다.
- 측정 Free가 O/R에 소진되는 충돌은 현재 문자열 데이터(측정 Free ≥4)에서 도달 불가 → 현재 의미론
  (측정 우선, 전용론미 존재시만 fallback) 유지 가능. 빈 verified 집합은 무쿼터 우회가 의도된 계약
  (하위 호환)이며, 발행 경로에서의 침묵 우회만 방지하면 됨.
- jev-1-13 유니콘 합집합 잔류(F1), 🆓 표기(F2), 사유 문구 분기(F4) — 현재 요청 문서 범위 밖. 미확정 보류.
- **잔여 검증(BLOCK 유지 근거)**: 실제 초안(tmp/letter-20261021-union-free-draft.md, DELTA 후 생성)
  best-1+2가 Free 워커 없음(206.95) — 발행 경로 표준 composition(buildThreeRole + run.top10.freeCatalog)
  으로 재산출해 201.90 나오는 것까지 확인 전 레터는 잠금. 확인 후 사용자 승인 산하 발행.

## 7. 판정

- 코드·계약: **PASS** (쿼터 구현·1471 check·표/댓글/publish 불변·소유 범위 준수).
- 레터 실출력: **PASS 재판정(초안)** — w1이 표준 buildThreeRole + 공식 verified 17 카탈로그(대시형) +
  실제 #265 Top15로 초안 조합 섹션을 재산출: best-1+2 = **201.90 실출력**(O claude-opus 72.95 /
  W gpt-luna 69.60 / W minimax 59.35), 4조합 모두 워커 verified Free ≥1·unmeasured 0, 나머지 3조합
  347.10/310.82/178.27 불변, 표·본문·댓글 계약 보존(조합 섹션만 교체). 코드 추가 수정 없음
  (git diff stat 동일: 9 files 126/118). BLOCK 해제. 발행은 사용자 승인 전 금지 유지.
- 계산 근거 재현: tsx eval로 unionPool/bestPlan 경로, 입력은 #265 Top7 — 본 문서 §1 표와 동일 출력 확인.
