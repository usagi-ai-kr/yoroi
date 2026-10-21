# Free 조합 정합·차선 캡션·시각화 (#261, w3)

- 목표: **#260 표시 규칙을 자격/매칭에도 공유** ✓ + 두 번째 조합 정책을 **Free** 로 확정 ✓ + 차선 캡션 라인화 ✓ + 이모지·뱃지 ✓.
- 금지 준수: 점수·가중치 0 · 순위 변경 0 · Free 표 **값** 변경 0 · publish 계약 0 · 점수 생성 0 · 소유 외 수정 0 · 커밋·push·외부 쓰기 0 ✓.

## 1. Free 조합 매칭 (canonical id)

- `model-display.ts` 에 `canonicalModelId` 추가 ✓ — **표시 = 자격** 같은 규칙(`-free`·effort 접미 제거 ✓).
- `letter-team-runners.ts` 에 `freePolicyPool(freeCatalogModelIds, { o, r, w })` 추가 ✓ —
  verified Free catalog 모델(Beam 포함 ✓)만 후보 ✓ · 역할 목록의 측정 점수는 **canonical id 매칭**으로 붙임 ✓ · 없으면 미측정 ✓.
- Free catalog id `deepseek-v4-1-flash-free` ↔ 역할 목록 id `deepseek-v4-1-flash` 가 매칭 ✓.
- **유료 오픈 모델 제외** ✓ — Kimi K3·MiMo Pro·GLM 5.3 은 Free catalog 에 없으므로 Free 조합에 들어가지 않음 ✓ (브랜드 일괄 판정 0 ✓).

## 2. 두 번째 정책 = Free

| 조합 | 라벨 | 후보 |
| --- | --- | --- |
| `best-1+1+3` / `best-1+2` | 가장 최선 | Top15 전 후보 + 점수 없는 Free 워커 fallback(필요 시만 ✓) |
| `free-1+1+3` / `free-1+2` | **Free** | verified Free catalog(Beam 포함)만 ✓ |
| 구성 불가 | — | `- ⚠️ 구성 불가` 사유(가짜 후보 0 ✓) |

- Free 후보 총점은 **측정 슬롯만** 합산 ✓ · 미측정 수는 `unmeasured` 로 별도 노출 ✓ (기존 계약 유지 ✓).
- 기대 데이터(합성 기준): 1+1+3 = O deepseek → R minimax → W mimo-flash/glm-flash/beam ✓, 1+2 = O deepseek → W minimax/mimo-flash ✓.

## 3. 차선 캡션 (역할별 개별 라인, fence 밖)

```
**🥈 차선**
- 🧭 오케스트레이터: o2
- 🔍 리뷰어: -
- 🛠️ 워커: -
```
- 1+2 는 **리뷰어 라인 없음** ✓ · 후보 없음은 `-` ✓ · 조합에 없는 역할 라인 미생성 ✓.
- 차선 후보는 조합에 사용되지 않은 모델 ✓ · 캡션은 Mermaid **fence 밖** ✓.

## 4. 이모지·뱃지

- 노드 라벨: `🧭 오케스트레이터` · `🔍 리뷰어` · `🛠️ 워커 N` ✓ · Free 후보는 `🆓` ✓.
- 조합 제목 badge 1개 ✓: `![best](https://img.shields.io/badge/🥇_가장_최선-1+1+3-blue)` · `![free](https://img.shields.io/badge/🆓_Free-1+1+3-2ea44f)` ✓.

## 5. 변경 파일·검증

| 파일 | 내용 |
| --- | --- |
| `src/insights/model-display.ts` (48줄) | `canonicalModelId` 추가(표시=자격) ✓ |
| `src/insights/letter-team-runners.ts` (44줄) | `freePolicyPool` 추가 ✓ |
| `src/insights/letter-team-combinations.ts` (98줄) | 정책 키 `open-*` → `free-*` ✓ · 입력 `openWeightKeys` → `freePool` ✓ · 라벨 `Free` ✓ |
| `src/insights/letter-mermaid.ts` (61줄) | 역할 이모지·Free 🆓 · 차선 개별 라인 · `combinationBadges` ✓ |
| `src/insights/letter-three-role-pipeline.ts` (99줄) | `freeCatalogModelIds` 입력 · Free 풀 구성 · 제목 badge 포함 조립 ✓ |
| `src/composition/insights-three-role.ts` (96줄) | verified Free catalog 모델 id 전달 ✓ |
| 테스트 4종 | `model-display` +1건(Free 매칭·유료 제외) · `team-combinations`·`mermaid`·`pipeline` 기대값 갱신 ✓ |
| `docs/insights/free-combo-matching-20261021.md` (신규) | 본 문서 ✓ |

- focused **36/36 통과** ✓ · `pnpm run check` 결과 아래 ✓ · typecheck 0 ✓ · validate exit 0 ✓ · diff-check clean ✓ · 각 파일 ≤100줄 ✓.
- **불변** ✓: Top7/Top15 표·점수·순위 · Free 표 값·실사용 열 · 댓글 3개 · publish 계약 · 2역할 경로.

## 5-1. Free 풀 보정(#261 free-pool-fix, w3)

- **canonical identityKey 부여** ✓ — `freePolicyPool` 의 모든 후보에 `canonicalModelId` 기반 identityKey ✓ →
  `deepseek-v4-1-flash` 와 `deepseek-v4-1-flash-free` 가 같은 실체로 dedupe ✓ (Zen/Go 양쪽에 같은 Free 모델이 올라와도 1개 ✓) → 한 조합에 중복 등장하지 않음 ✓.
- **미측정 Free 는 워커 fallback 전용** ✓ — 오케·리뷰어 Free 풀에는 **역할별 측정 점수가 있는 후보만** ✓ →
  Beam 같은 미측정 Free 는 O/R 슬롯·차선 캡션에 나오지 않음 ✓ · 워커 슬롯(필요 시 fallback)으로만 ✓.
- **Free 풀 정렬** ✓ — 측정 슬롯은 점수 내림차순, 미측정은 뒤로 ✓.
- 결과(합성 기준) ✓: `free-1+1+3` = O deepseek → R minimax → W mimo-flash/glm-flash/beam(미측정 1) ✓,
  `free-1+2` = O deepseek → W minimax/mimo-flash ✓ · MiniMax·Beam 등장 ✓ · deepseek 중복 0 ✓.

## 5-2. Free 풀 회귀 테스트(#261 free-pool-regression-tests, w3 · 테스트 전용)

- **프로덕션 코드 무변경** ✓ (점수·순위·Free 표·publish 불변 ✓) — 소유 테스트 2종만 보강 ✓.
- `tests/model-display.test.ts` 신규 2건 ✓:
  1. **canonical 중복 금지** ✓ — 실제 `freePolicyPool` → `buildTeamCombinations` 경로로 Free 1+1+3·1+2 조합을 만들고
     슬롯의 canonical id 집합 크기 == 슬롯 수 ✓ (deepseek-v4-1-flash 와 -free 가 같은 실체로 접힘 ✓) · deepseek 1회만 ✓.
  2. **미측정 Free 는 워커 fallback 전용** ✓ — freePolicyPool 의 o/r 풀에 `score === undefined` 없음 ✓ ·
     Beam 만 워커 풀에 미측정으로 존재 ✓ · Free 1+1+3 의 O/R 슬롯은 모두 측정 ✓ · `unmeasured === 1` ✓.
- 기존 회귀 유지 ✓ — Free/base 매칭(측정 점수 매칭)·유료 Kimi/MiMo Pro/GLM 5.3 제외 ✓ · 규칙 순서·중첩 접미·미지 id·오류 폴백 ✓.
- 점수 날조 없음 ✓ — 합성 fixture 의 실제 점수만 사용 ✓.

## 5-3. identityKey 결함 민감도 회귀(#261 duplicate-test-sensitivity, w3 · 테스트 전용)

- **픽스처** ✓ — free IDs `[deepseek-v4-1-flash-free, mimo-v2-6-flash-free]` · o `[deepseek 62.9]` · r `[mimo 0.7]` · w `[mimo 58]` ✓.
- **정상 동작** ✓ — 워커 풀의 canonical 중복 0 ✓ · `free-1+2` 는 워커 후보 부족으로 **feasible=false** ✓ · 슬롯 0 ✓ · 사유 표시 ✓.
- **결함 시(identityKey 누락)** ✗ — 미측정 `deepseek-v4-1-flash-free` 의 정체성이 `deepseek-v4-1-flash` 와 달라 dedupe 가 깨지고 ✗ →
  워커 2슬롯이 채워져 `free-1+2` 가 **feasible=true** 가 됨 ✗ → 위 회귀가 **실패** ✓ (민감도 확인 ✓).
  (시뮬레이션: identityKey 없이 만든 풀에서 `resolveIdentityKey` 결과가 `deepseek-v4-1-flash-free` 로 갈리는 것을 확인 ✓.)
- 프로덕션 코드·점수·순위·Free 표·publish 무변경 ✓ · 기존 회귀(중복·O/R 미측정 제외·Beam fallback·유료 제외·차선/뱃지) 유지 ✓.

## 6. 재발행 위험

1. Free 조합에 **MiniMax·Beam 이 실제로 들어가고** Kimi K3·MiMo Pro·GLM 5.3 은 없는지 확인 ✓.
2. 차선 캡션이 **역할별 라인**이고 1+2 에 리뷰어 라인이 없는지 ✓ · 조합 모델 재사용 0 ✓.
3. **미측정 Free 후보의 총점 미포함** + `unmeasured` 노출 ✓ · Mermaid 의 `🆓` 표기 ✓.
4. badge URL( shields.io · 이모지 포함 ✓)이 GitHub 렌더에서 깨지지 않는지 확인 ✓.
5. 조합 블록이 늘어나 **본문 상한**에 걸리지 않는지 ✓ · Free 표·댓글은 불변 ✓.
