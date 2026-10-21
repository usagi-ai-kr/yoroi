# glm-5-3 / glm-5-3-flash 정성 표기 판정 (2026-10-21, w3 · #231)

- 대상: `docs/insights/free-footnote-fix-20261021.md` §4 후속 — 레터 3역할 표에 표시되는 `glm-5-3` 과
  Free 목록의 `glm-5-3-flash` 가 같은 모델(공식 base/약칭)인지 확인해 정성 각주 표기 여부를 결정.
- **판정: 별개 모델(alias 아님)** → 병합하지 않고 `glm-5-3` 행의 각주는 **비어 둔다** ✓.
  `config/model-role-fit.json` · `src/insights/model-aliases.ts` **무변경** ✓ (설정 키 `glm-5-3-flash` 유지 ✓).

## 1. 근거 (확인 시각: 2026-10-21, 저장 소스 기준)

1. **공식 OpenCode Console(=Zen) Free 목록** — 저장 스냅샷 `src/insights/opencode-free-official.ts`
   (`OFFICIAL_LISTING_CHECKED_ON = 2026-10-20`), 출처 URL `https://opencode.ai/v2/docs/console/models` ·
   `https://opencode.ai/v2/docs/console/go`:
   - `OFFICIAL_ZEN_FREE_IDS` 에 **`glm-5.3-flash-free` 등재** ✓ · **무-flash `glm-5-3` 은 미등재** ✓.
   - Go Free 목록(`OFFICIAL_GO_FREE_IDS`) 에 glm 없음 ✓.
   → 공식 무료 제공은 Flash 변형뿐 ✓.
2. **이미 검증된 별칭 규칙**(w1 A, `src/insights/model-aliases.ts` 25행):
   `from: 'glm-5-3-flash-free' → to: 'glm-5-3-flash'`, basis `공식 Free 목록 등재 + AA intel id 일치(2026-10-20 확인)` ✓
   → AA intel id 는 **`glm-5-3-flash`** ✓ (`glm-5-3` 아님 ✓).
3. **AA 모델 id 공간**(레터 파생 픽스처):
   - `tests/insights-letter-top10.test.ts` 의 AA 모델 목록에 `glm-5-3-flash`(스코어 70)와 `glm-5-3`(73)이 **각각 별개 항목** ✓.
   - `tests/insights-reviewer-composition.test.ts` 의 id 목록에 둘이 공존 ✓. `glm-5-3` 는 자기 effort 변형(`-high`·`-low`·`-xhigh`)을,
     `glm-5-3-flash` 는 자기 변형(`-xhigh`)을 갖는다 ✓ → AA 가 **두 모델을 별개로 등재** ✓.
4. **발행 레터 #229 실측**(2026-10-21T00:26:15Z, 읽기 전용 확인): 같은 실행에서
   워커 Top15에 `glm-5-3`(53.2) ✓, Free 티어 표에 `glm-5-3-flash`(AA 지수 41.8) ✓ → **별개 행·별개 모델** ✓.

## 2. 판정 근거 정리

- `glm-5-3` 을 `glm-5-3-flash` 의 약칭으로 볼 근거가 **없다** ✗ → `unrelated_model_merge` 금지에 부합 ✓.
- 반대로 근거가 없다는 이유로 `glm-5-3` 이 flash 의 변형이라고 **단정할 수도 없다** ✗ → 각주를 비워 두는 것이 정직한 처리 ✓.
- 따라서 **설정·alias 무변경** ✓: `config/model-role-fit.json` 의 키 `glm-5-3-flash` 는 `glm-5-3-flash` 계열
  (`glm-5-3-flash`·`glm-5-3-flash-free`·effort 변형)에만 적용 ✓ ✓.

## 3. 회귀 테스트 (`tests/insights-model-role-fit.test.ts` 신규 1건)

`glm-5-3 은 glm-5-3-flash 의 약칭이 아니라 별개 모델로 각주가 비어 있다`:
- `roleFitNote('glm-5-3','worker'|'orchestrator')` → `undefined` (비표시 명시) ✓
- `roleFitNote('glm-5-3-flash','worker')` → usagi 각주 유지 ✓ · `roleFitNote('glm-5-3-flash-free','worker')` → 동일 각주(#230 정규화) ✓
- 렌더: `glm-5-3` 항목 → 각주 없음 ✓ / `glm-5-3-flash` 항목 → `> glm-5-3-flash: usagi …` 표시 ✓
- 다른 모델 각주 불변 ✓ (기존 테스트군으로 확인 ✓)

## 4. 검증

| 항목 | 결과 |
| --- | --- |
| focused 테스트 | `tests/insights-model-role-fit.test.ts` **11/11 통과** ✓ (신규 1건 포함) · 관련 회귀군 포함 **52/52 통과** ✓ |
| `pnpm run typecheck` | 오류 **0건** ✓ |
| `python3 scripts/validate-repo.py` | **exit 0** · 위반 0건 ✓ |
| `git diff --check` | clean ✓ |
| 전체 `pnpm run check` | 미실행 — 오케스트레이터가 U3a 통합 후 1회 ✓ (조정) |
| 금지 준수 | unrelated 병합 0 · 점수·가중치 변경 0 · 재발행 0 · 외부 쓰기 0 · 소유 외 파일 수정 0 · 커밋·push 0 ✓ |

## 5. 다음 발행 확인 항목

1. 워커·오케 표의 `glm-5-3` 행에는 **각주가 없는 것**(현재 판정) ✓.
2. `glm-5-3-flash` 계열 행에는 각주가 붙는 것(#230 정규화 반영) ✓.
3. 두 모델이 **같은 행으로 합쳐지지 않는 것**(별개 유지) ✓.
4. (후속) usagi 관찰이 `glm-5-3` 자체를 다룬다면 **새 설정 항목 추가**(병합이 아니라 데이터 추가) → 별도 단위 ✓.
