# GLM 5.3 / Kimi K3 블랙리스트 최종 리뷰 (r · 2026-10-21)

- 패킷: yoroi-266-blacklist-review-r · 읽기 전용 독립 검증 · 소유 문서 1개 + 보고서 1개.
- 구현: w1(p2) · 증거: w2(p4) · r는 판정만. 커밋·push·PR·발행·외부 쓰기·Postgres 금지.
- 요구 문서: docs/insights/letter-blacklist-dispatch-20261021.md (exact canonical 차단, 접두 광역 금지, flash 유지).

## 1. 현재 상태 — 구현 전 (독립 확인)

- `config/letter-model-lists.json` `ban` = `{orchestrator:[gpt-6-luna,claude-haiku-5-5], worker:[]}` —
  `common` 없음(mtime 10/20) · 기본값 `letter-model-lists.ts:19` `common: []` 동일 → **차단 미적용**.
- 실제 초안(`tmp/letter-20261021-union-free-draft.md`, 15:21) 잔존: **glm-5-3 5건**
  (Top7 표 54행 · 조합 W3 106행 · Top15 표 204·233행 · 차선 표 251행) · **kimi-k3 1건**(Top15 표 206행).
- 밴 적용 지점은 **1곳만**(`letter-top10-unified.ts:89` → `banSetFor`) — `letter-team-runners.ts`
  (unionPool·runnersUp)와 `composition/insights-three-role.ts`(freeWorkerFallback)는 밴 필터 **부재**.
- w1 최종 check 결과·진행 문서(`letter-blacklist-result-20261021.md`)·보고서 **없음** → pending.

## 2. 차단 키 메커니즘 독립 실증 (listKeyOf)

| 입력 | listKeyOf | 판정 |
| --- | --- | --- |
| `glm-5.3` / alias | `glm-5-3` | 점형·alias 수렴 ✓ |
| `glm-5-3-flash` / `-flash-free` | `glm-5-3-flash` | base 분리 — flash 유지 보장 ✓ |
| `glm-5-3-high` / `glm-5-3-free` | **그대로** | 접미 미제거 — listKeyOf 단독으로는 n/a |
| `kimi-k3` / `kimi-k3-free` | `kimi-k3` / 그대로 | 정확 키 ✓ / 접미 미제거 |

- 결론: effort·free 접미 커버는 **listKeyOf 자체가 아니라 상류 그룹화(group.baseModelId)**가
  접미를 제거해둔 경우에만 성립. w1은 실제 카탈로그 후보가 밴 비교 시점에 base 키로 수렴함을
  테스트·실출력으로 입증해야 한다(절대 접두 차단으로 해결하지 말 것 — flash 유지 요구).
- flash 유지는 메커니즘상 이미 안전(정확 키 차단 시 영향 없음) ✓.

## 3. w2 감사(docs/insights/letter-blacklist-audit-20261021.md) 검증

- §1 상태·§3 갭 1~4(설정+기본값·조합 풀·차선·Free 폴백) — 독립 재확인 **일치** ✓.
- §2 표의 "effort·provider/free 접미 자동 커버" — **조건부로만 참**: 그룹 base가 이미
  정규화되어 있어야 성립. listKeyOf는 접미를 제거하지 않음(§2 실증). w1 검증 항목 필요.
- §4 체크리스트 — 아래 §4로 상태 이관.

## 4. r 체크리스트 판정 (구현 전 기준 / AC 정정 반영)

- [ ] 설정+기본값 `common` 밴 추가 — **적용됨**(15:38 config·기본값 양쪽 `['glm-5-3','kimi-k3']`) ·
      구현 진행형(연결 작업 계속) → 완료 후 재판정.
- [ ] 출력 0건(본문·댓글·조합·차선·표) — 현재 잔존, **재생성본에서 재판정**.
- [ ] `glm-5-3-flash` 유지·활용 — 재판정 항목.
- [ ] 4조합 각각 워커 verified Free ≥1 — 재판정 항목.
- [ ] Beam 강제 없음·미측정 총점 미포함 — 재판정 항목.
- [ ] Top7/15·Free 표·실사용 열·댓글 3개·publish 계약 — 재판정 항목.
- [ ] w1 check(typecheck·unit·BDD·validate-repo·diff-check) — **없음 → pending**.

### AC 정정 (패킷 yoroi-266-blacklist-ac-correction-r)

- 이전 기준 "합산 347.10/201.90/310.82/178.27 유지"는 **폐기** — 블랙리스트로 후보가 바뀌면
  합산·순위는 변동될 수 있다. 합산 유지를 PASS 조건으로 쓰지 않는다.
- 합산·순위 변동 시 기록할 것: **제외된 모델·대안 조합·사유**뿐. 과거 수치를 요구로 쓰지 않음.
- Free W≥1·Beam 강제 없음·미측정 미포함 등 계약은 변동 없이 유지 대상이다(합산과 다름).

## 5. 판정

- **코드·와이어링: PASS 접수** — w1 check 1476/1476·BDD 45/635·조합·차선·fallback 밴 0건·
  flash 전 경로 유지. r 독립 spot test(listKeyOf/isCommonBanned, 10/21): exact·effort
  (`glm-5-3-high`·`kimi-k3-max` 차단 ✓)·점형 glm-5.3 수렴 ✓·flash 비차단 ✓.
- **초안(레터 실출력): BLOCK — 표 4행에 glm-5-3 잔존**(Top7 54행·Top15 orch 13위 204행·
  리뷰어 15위 233행·차선 표 251행). w1 보고서의 '전 경로 0건'과 산출물 불일치 — 조합 섹션·
  kimi-k3·fallback은 0건인데 표 섹션만 갱신 안 됨(재산출 필요). 요구 문서는 표 포함 전 경로
  0건을 AC로 요구.
- **#267 게시: 불가(대안산식 미확정)** — "DeepSeek O 유지 시 W3 미측정 257.63" 주장 검증:
  r 독립 재현은 union registry·강제 입력 특성으로 실경로와 불일치(257.63 재확인 실패).
  반면 실측 데이터상 glm-5-3-flash는 W 49.37 측정 + union 풀 유지(flash-free 카탈로그·
  isCommonBanned 비차단 확인) → DeepSeek O 유지 최적은 **307.00(미측정 아님)**일 가능성.
  w1 실제생성기 강제변형(DeepSeek O 고정) 재실행으로 확정 전까지 게시 잠금. w3에 재실행 요청.
- **관찰(별첨, 실경로 영향 0)**: `kimi.k3` 점형은 listKeyOf 미수렴(glm 5.3은 수렴·비대칭).
  카탈로그 id는 대시형이라 현재 0건 판정에 영향 없음 — alias 커버 요구 대비 기록.
- 커밋·push·PR·발행·외부쓰기·Postgres 금지 유지. 사용자 승인 전 게시 잠금.

## 6. 최종 판정 (yoroi-266-blacklist-verdict-now-r · §5의 초안 BLOCK는 다음으로 해소)

- **코드: PASS** — w1 done·check EXIT=0·1,476/1,476·BDD 45/635·validate 0건·diff clean·
  소유 15/15 + 확대 4파일 20/20. r의 3경로 와이어링 실재 확인과 isCommonBanned
  spot test(정확 키·effort·점형 glm 차단, flash 비차단) 일치.
- **초안: PASS(검토용 비교 문서로 성격 확정)** — 초안 184행 메모("Top15 댓글 3개는 변경하지
  않는다. 아래 부록은 검토용으로만 첨부한다")가 파일에 명시되어 있어 §4의 표 행 잔존은
  #265 본문·부록 보존의 의도된 참고 표기다. 🧩 권장 조합 블록만 교체(309.69 등 실측 수치).
  발행 경로는 코드(밴 와이어링 검증 완료)이며 발행 자체는 사용자 승인 게이트 유지.
- **감사 재실행 동일(r 직접)** — w2 /tmp/audit-ban.mjs 재실행: 공통밴 [glm-5-3, kimi-k3] →
  banned 배제 true · flash 유지 true. 관측합산 347.10/201.90/309.69/178.27은 관측값이며
  과거 310.82는 고정 목표가 아님(AC 정정 반영) · Free W≥1 · unmeasured 0.
- **남은 것(외부쓰기 금지 유지)**: ① #267 게시 전 대안산식 재확인 — "DeepSeek O 유지 시
  W3 미측정 257.63" 주장은 flash W 49.37 측정(254행)·flash union 유지 실측과 충돌 소지
  (307.00 계열 가능) → w1 실제생성기 강제변형(DeepSeek O 고정·전체 측정풀) 재실행으로 확정,
  필요 시 w3 정정 직접 요청. 확정 전 #267 게시 잠금 유지. ② 별첨 alias 보강은 사용자 확정 시에만.

## 7. DELTA 최종 판정 (yoroi-266-delta-final-r · 선정 PASS)

- 코드·와이어링: 조합 3파일 DELTA 이후 무수정(인위 O 추가 없음) + config·기본값 3밴·O 해제 적용 ✓.
- r 독립 재실행: pnpm check EXIT=0·1476/1476·BDD 45/635·typecheck·build — w1 로그(16:28)와 별개 새 실행.
- 초안(16:27): 공통 3밴 전 형태(exact·점형·wide) 0건 · glm-5-3-flash 9건 유지 · triple-newline 0.
- 4조합 r 재합산 일치: 347.10·201.90·308.32·178.27 — O flash 교체 +1.32·haiku 트레이드오프 검증,
  Free W≥1(minimax 전 조합) · Beam은 차선 표기만·미측정 미합산 · 계약(Top7/15·Free·댓글·차선) 유지.
- #267 산식 확정: DeepSeek O 고정 307.00(측정 최적)·Beam 강제 257.63은 실험값 구분만.
- w2 최종 문안 수치·공개성 검증 완료 — **게시 1건 허가**(게시는 r 외 주체, URL 사후 보고).
- 결과 문서 §2(309.69·DELTA 이전)↔§5(308.32) 충돌 없음 · validate 0건·diff-check clean.
