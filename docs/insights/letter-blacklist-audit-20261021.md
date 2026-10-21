# GLM 5.3 / Kimi K3 블랙리스트 감사 (w2 · 읽기 전용, 2026-10-21)

- 범위: **읽기 전용 독립 감사** ✓ — 활성 설정 → 실제 canonical 카탈로그 → 상위 출력까지 커버리지를 확인 ✓.
  소스 변경 0건 ✓ · 커밋·push·PR·발행·외부 쓰기 0건 ✓ · 0.3.x/PostgreSQL 중단 유지 ✓.
- 구현은 w1(p2) ✓ — 본 문서는 중복 구현 없이 **증거·갭·체크리스트**만 제공 ✓ · r(p7) 최종 리뷰는 별도 패킷으로 요청 ✓.

## 1. 현재 상태 (구현 전)

- `config/letter-model-lists.json` 의 `ban` ✓ = `{ "orchestrator": ["gpt-6-luna","claude-haiku-5-5"], "worker": [] }` ✓ → **`common` 비어 있음** ✓ → GLM 5.3·Kimi K3 은 **아직 차단되지 않았음** ✓.
- `src/insights/letter-model-lists.ts:19` 기본값도 동일 ✓ (`common: []` ✓) → 기본값·설정 양쪽 갱신 필요 ✓.
- 상위 출력(초안 `tmp/letter-20261021-union-free-draft.md`) 에 `glm-5-3` ✓(W3 슬롯·여러 표 행 ✓) 과 `kimi-k3` ✓(Top15 표 ✓) 가 **등장** ✓ → 차단 전 상태 ✓.

## 2. 차단 키 판정 (요구 문서 기준)

| 항목 | 판정 | 근거 |
| --- | --- | --- |
| `glm-5-3`·`kimi-k3` 정확 키 | 차단 대상 ✓ | 요구: exact canonical ✓ · 접두 광역 금지 ✓ |
| effort 변형(`glm-5-3-high` 등) | **자동 커버** ✓ | `buildList` 는 `listKeyOf(s.group.baseModelId)` 로 그룹 base 비교 ✓ (`letter-top10-unified.ts:38` ✓) → effort·경로 변형은 같은 base ✓ |
| provider/free 접미(`kimi-k3-free` 등) | **자동 커버** ✓ | 동일 base 비교 ✓ + `listKeyOf` = `resolveModelId(normalizeModelName(id))` ✓ (alias 규칙 경유 ✓) |
| alias 형태 | base 정규화로 수렴 ✓ | `MODEL_ALIAS_RULES` 경유 ✓ → base 키로 일치 ✓ |
| `glm-5-3-flash` | **유지되어야 함** ✓ | base 가 `glm-5-3` 와 다름 ✓ → exact 키 차단 시 영향 없음 ✓ (접두 차단 금지 ✓) |
| 공통 밴 적용 범위 | **요구: 전 역할·표·추천·차선·폴백** ✓ | 현재 적용 지점은 **1곳**(`letter-top10-unified.ts:89` → `banSetFor` ✓) → 나머지는 간접 커버 ✓ |

## 3. 커버리지 갭 (w1 구현 대상 · 증거)

1. **설정·기본값** ✓ — `config/letter-model-lists.json` 의 `ban.common` 에 `glm-5-3`·`kimi-k3` 추가 ✓ +
   `src/insights/letter-model-lists.ts:19` 기본값 `common` 동일 추가 ✓ (설정만 바꾸면 기본값 불일치 ✗ → 양쪽 필요 ✓).
2. **추천(조합) 풀** ⚠ — `letter-team-runners.ts` 의 `unionPool` 은 밴을 적용하지 않음 ✓ →
   레지스트리 출처 `kimi-k3`·`glm-5-3` 은 **측정 점수가 없어 O/R 슬롯은 못 들어가지만** 미측정 폴백으로 **워커 슬롯·차선 라인에 진입 가능** ✓ → 명시적 필터 필요 ✓.
3. **차선(runners-up)** ⚠ — `runnersUp` 도 밴 미적용 ✓ → 위 미측정 후보가 차선 라인으로 노출될 수 있음 ✓ → `banSetFor`/공통 밴 필터 연결 필요 ✓.
4. **Free 폴백** ⚠ — `composition/insights-three-role.ts` 의 `freeWorkerFallback` 은 Free catalog 출처 ✓ (현재 밴 대상 모델 없음 ✓) → **잠재 갭** ✓ → 공통 밴 필터 권장 ✓.
5. **Free 표** ✓ — 역할 목록 파생 ✓ → 선택 단계 밴으로 간접 배제 ✓ (+ 미측정 Free 행 ✗ → 위 4번 ✓).
6. **대시형/점형 id** ✓ — `listKeyOf` 가 `normalizeModelName` + alias 해석 ✓ → 점형 `glm-5.3`·`kimi.k3` 형태도 base 로 수렴 ✓ (없어도 안전 ✓).

## 4. 검증 체크리스트 (r 최종 리뷰용)

- [ ] `config/letter-model-lists.json` + `letter-model-lists.ts` 기본값에 `glm-5-3`·`kimi-k3` 공통 밴 ✓.
- [ ] **실제 상위 출력**(`tmp/letter-20261021-union-free-draft.md` 재생성 ✓)에 `glm-5-3`·`kimi-k3` 이 **0건** ✓ (본문·댓글·조합·차선 전부 ✓).
- [ ] `glm-5-3-flash` 는 **유지** ✓ (Top7/15·조합·차선에 등장 가능 ✓).
- [ ] 4조합( best/open × 1+1+3/1+2 ) 각각 **워커 verified Free ≥1** 유지 ✓ · Beam 강제 없음 ✓ · 미측정 총점 미포함 ✓.
- [ ] O 강제 없음 ✓ · **합산·순위는 차단으로 변동될 수 있다**(사용자 2모델 블랙리스트 ✓) → 과거 수치(347.10/201.90/310.82/178.27)를 AC 로 강제하지 않는다 ✓ · 변동 시 사유(제외된 모델·대안 조합)만 기록 ✓.
- [ ] w1 최종 `pnpm run check` · `validate-repo` · `diff-check` 결과 ✓ (없으면 pending 명시 ✓).
- [ ] 커밋·PR·발행 없음 ✓ (사용자 승인 전 ✓).

## 5. 미완료·대기 상태

- w1 구현 **미착수 상태**(설정·기본값 미변경 ✓) → 본 감사 결과는 **pre-implementation 커버리지** ✓.
- w1 구현 + 상위 출력 재생성 후 위 체크리스트로 r 이 최종 판정 ✓ → 그때 PASS/BLOCK 확정 ✓.
- w2 는 비작성자 ✓ → 구현·재생성不承担 ✓ · 증거·체크리스트만 제공 ✓.
