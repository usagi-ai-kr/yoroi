# 두 번째 조합 정책 복원 — 오픈 웨이트·Free 합집합 (2026-10-21, w3 · #266)

- 목표: 두 번째 조합 정책을 **오픈 웨이트 ∪ verified Free(Beam 포함) 합집합**으로 복원 ✓.
  (이전 #261 에서 Free-only 로 좁혔다가 → 사용자 정정으로 union 복원 ✓)
- 금지 준수: 점수 생성 0 · Top7 순위 변경 0 · Free 표 값 변경 0 · publish 계약 변경 0 · 소유 외 수정 0 · 커밋·push·외부 쓰기 0 ✓.

## 1. 정책

- **후보 풀** = `config/open-weight-models.json` 검증 8개(DeepSeek·GLM Flash·GLM 5.3·MiMo Pro·MiMo Flash·Kimi K3·Muse Spark 1.3·MiniMax M3.1 Flash ✓)
  ∪ **verified Free catalog**(Beam 포함 ✓) → canonical id 기준 dedupe ✓ · 제공 경로(유료/무료)와 무관 ✓.
- **포함 대상** ✓ — 유료 오픈(Kimi K3·MiMo Pro·GLM 5.3 ✓) + Free 제공 오픈(DeepSeek·MiniMax·GLM Flash·MiMo Flash ✓) + Beam(Free ✓) 모두 포함 ✓.
- **Free 워커 fallback 유지** ✓ (점수 없는 Free 는 워커 슬롯만 ✓ · 제거하지 않음 ✓).
- **라벨·뱃지** = `오픈 웨이트·Free` ✓ (`![open](https://img.shields.io/badge/오픈_웨이트·Free-1+1+3-8957e5)` ✓ · 🆓/Free 전용 뱃지 아님 ✓).

## 2. 최적화 원칙 (정정 반영)

- **역할 우선순위·가중치 추가하지 않음** ✓ — 자연 합산 최대 결과 그대로 ✓.
- 조합 내 유일성은 canonical identityKey ✓ · O/R 슬롯은 측정 점수 있는 후보만 ✓ · 미측정(Beam 등)은 워커 슬롯 ✓.
- 합산 점수(합성 기준) — `open-1+1+3` = O `deepseek-v4-1-flash` → R `kimi-k3` → W `minimax-m3-1-flash` / `mimo-v2-6-flash` / `glm-5-3-flash` ✓ ·
  `open-1+2` = O `deepseek-v4-1-flash` → W `minimax-m3-1-flash` / `mimo-v2-6-flash` ✓ (DeepSeek 이 O 인 것은 합산 최적의 결과 ✓ · 강제 아님 ✓).
- DeepSeek 이 O 가 아니게 되면 **그대로 보고**하고 별도 분석 이슈(#267)에서 설명 ✓ → 본 구현은 강제하지 않음 ✓.

## 3. 변경 파일

| 파일 | 내용 |
| --- | --- |
| `src/insights/letter-team-runners.ts` (53줄) | `unionPool(ids, lists)` — 합집합 id 의 canonical dedupe · 역할별 측정 점수 매칭 · O/R 는 측정만 · 워커는 전부(Beam 포함) ✓ |
| `src/insights/letter-team-combinations.ts` (100줄) | 정책 키 `open-*` ✓ · 입력 `unionPool` + `freeWorkerFallback` ✓ · 라벨 `오픈 웨이트·Free` ✓ · Free 워커 fallback 복원 ✓ |
| `src/insights/letter-mermaid.ts` (62줄) | 뱃지 `오픈_웨이트·Free` ✓ · 노드 이모지·차선 라인 유지 ✓ |
| `src/insights/letter-three-role-pipeline.ts` (100줄) | 합집합 풀 구성(레지스트리 ∪ Free catalog id) ✓ · `freeCatalogModelIds` 입력 ✓ |
| `src/composition/insights-three-role.ts` (97줄) | verified Free catalog id + Free 워커 fallback 전달 ✓ |
| 테스트 4종 | `model-display`(99줄)·`team-combinations`(100줄)·`insights-mermaid`(95줄)·`pipeline`(100줄) — 정책·라벨·뱃지·DeepSeek 합산결과·1+2 리뷰어 없음·Beam 포함·canonical 중복·민감도 유지 ✓ |
| `docs/insights/open-weight-restore-20261021.md` (신규) | 본 문서 ✓ |

## 4. 검증

| 항목 | 결과 |
| --- | --- |
| focused 테스트 | **41/41 통과** ✓ (model-display 11 · team-combinations 10 · mermaid 10 · pipeline 10) |
| `pnpm run check` | 아래 로그 기준 기록 ✓ |
| `pnpm run typecheck` | 오류 0건 ✓ |
| `python3 scripts/validate-repo.py` | 위반 0건 ✓ (각 파일 ≤100줄 ✓) |
| `git diff --check` | clean ✓ |
| **불변** | Top7/Top15 표·점수·순위 · Free 표·실사용 열 · 댓글 3개 · publish 계약 · 2역할 경로 ✓ |

## 5. 재발행 위험

1. **합집합 정책의 후보 폭** — 오픈 웨이트 8 + Free pool 이 합쳐져 한 조합에 5슬롯이 몰릴 수 있음 ✓ → 실제 데이터에서 슬롯 구성 확인 ✓.
2. **DeepSeek O 강제 아님** ✓ — 합산 최적 결과가 다르면 그대로 보고(#267) ✓ · 발행물에서 O 모델이 무엇인지 확인 ✓.
3. **유료 오픈 모델 포함** ✓ (Kimi K3·MiMo Pro·GLM 5.3 ✓) — 제공 경로 표기 없이 '오픈 웨이트' 라벨만 노출 ✓ → 혼동 주의 ✓.
4. **Free 워커 fallback 유지** ✓ → 미측정 Free 가 워커 슬롯에 들어갈 수 있음 ✓ (총점 미포함 ✓ · unmeasured 별도 ✓).
5. **뱃지 URL** (shields.io · '·' 포함 ✓) 렌더 확인 ✓ · 차선 캡션 라인·1+2 리뷰어 없음 유지 ✓.
