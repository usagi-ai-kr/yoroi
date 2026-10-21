# Free 모델 usagi 각주 누락 수정 (2026-10-21, w3 · #230)

- 대상: `docs/insights/letter-229-verification-20261021.md` §2 **BLOCK 1건** — 재발행 #229에서
  워커·오케 역할의 Free 모델 usagi 정성 각주가 누락됨.
- 판정: **수정 완료** (점수·가중치·순위 변경 0 · 레터 재발행 0 · 외부 쓰기 0 · 소유 외 파일 수정 0).

## 1. 원인

- 3역할 각주 조회는 원본 id 를 쓴다: `letter-three-role-render.ts` → `roleFitNote(entry.modelId, role)`.
- 워커·오케 항목 id 는 **공식 Free 카탈로그 id**(`deepseek-v4-1-flash-free` 등)이고,
  `roleFitBaseId` 는 effort 접미만 제거 → `normalizeModelName('deepseek-v4-1-flash-free')` = `deepseek-v4-1-flash-free`
  → `config/model-role-fit.json` 의 AA base 키와 불일치 → note 미확인 ✗.
- 리뷰어 역할은 후보 id 가 AA 원형이라 정상 표시 → **워커·오케만** 누락 ✗.

## 2. 수정 (소유 파일 1건)

`src/insights/model-role-fit.ts` — `roleFitBaseId` 정규화 확장:

```ts
const ROLE_FIT_SUFFIX = /-(?:free|minimal|low|medium|high|xhigh|max)$/;
export const roleFitBaseId = (modelId: string): string => {
  let id = modelId;
  for (let i = 0; i < 2 && ROLE_FIT_SUFFIX.test(id); i += 1) id = id.replace(ROLE_FIT_SUFFIX, '');
  return normalizeModelName(id);
};
```

- `-free` 와 effort 접미를 **모두** 제거 ✓ (`deepseek-v4-1-flash-free` → `deepseek-v4-1-flash` ✓, `…-free-high` 형태도 2회 제거로 base ✓).
- **설정 키는 AA base 그대로 유지** ✓ (`config/model-role-fit.json` 무변경 ✓ · 키 접미 충돌 0건 확인 ✓).
- 렌더러(`letter-three-role-render.ts`)는 변경 없음 ✓ — 표시는 이미 base 형태(`modelCell`)·조회만 정규화 수정으로 해결 ✓.
- 점수·순위·파레토·가중치·각주 위치(표 아래)·중복 제거 규칙 모두 불변 ✓.

## 3. 회귀 테스트 (소유 테스트 2건)

`tests/insights-model-role-fit.test.ts` (신규 4건):
1. `Free 접미 id 를 base 로 정규화한다` — deepseek/glm/mimo/minimax `-free` → base ✓, `…-free-high` → base ✓, base 는 불변 ✓.
2. `Free id 로 온 워커·오케 항목에 정성 각주가 붙는다` — 4개 Free id × 워커·오케 각주 존재 ✓.
3. `미확인 Free id 에는 각주를 만들지 않는다` — `unknown-model-free` 각주 없음 ✓ · 관찰 없는 역할 undefined ✓ · 렌더에도 각주 없음 ✓.
4. `렌더: Free id 항목에도 표 아래 각주가 표시되고 점수 칸은 불변` — `> deepseek-v4-1-flash: usagi …` ✓ · 스코어 칸 `57.6` 불변 ✓.

`tests/insights-three-role-body.test.ts` (신규 1건):
5. 3역할 섹션의 usagi 각주(Free id 포함)가 본문 교체 후에도 그대로 남고 2역할 전용 안내는 계속 제거 ✓.

**기존 출력 불변 확인**: 비-Free 3역할 렌더·Free 표·댓글 구성은 관련 회귀군 포함 **52/52 통과** ✓
(role-fit·three-role body/legend·Free 표·Free 리뷰어(wiring/publish/integration)·리뷰어 파레토·composition·pipeline) ✓.

## 4. glm-5-3(표) vs glm-5-3-flash(설정 키) 판정 → **같은 정규화로 해결되지 않음(별도 후속)**

- `roleFitBaseId('glm-5-3')` = `glm-5-3` ✗ → 설정 키 `glm-5-3-flash` 와 불일치 → 각주 계속 미표시 ✗.
- `glm-5-3-flash`·`glm-5-3-flash-free` 는 정상 매칭 ✓ (`glm-5-3-free` 도 `glm-5-3` 로 남음 ✗).
- **unrelated 병합(별칭·약칭 매핑) 금지** → 설정·alias 통합은 별도 결정 필요 → **후속으로 보고만** ✓.

## 5. 검증

| 항목 | 결과 |
| --- | --- |
| focused 테스트 | **52/52 통과** ✓ (내 신규 5건 포함) |
| `pnpm run typecheck` | 오류 **0건** ✓ |
| `python3 scripts/validate-repo.py` | **exit 0** · `PASS: 993 files, 8 skills` · 위반 0건 ✓ |
| `git diff --check` | clean ✓ |
| 전체 `pnpm run check` | 1417 중 **1415 통과 / 2 실패** — 실패 2건은 **비소유** `tests/insights-dimension-contract.test.ts`·`tests/insights-top10-source-policy.test.ts`(U2 registry messenger 역할 추가 관련, w1 수정 중) ✓. 오케스트레이터 조정으로 전체 check 는 통합 트리에서 1회 실행 ✓ (로그 `tmp/yoroi-230-free-footnote-check.log`) |
| 금지 준수 | 점수·가중치·순위 변경 0 · 재발행 0 · 외부 쓰기 0 · 소유 외 파일 수정 0 · 커밋·push 0 ✓ |

## 6. 다음 발행(#230 재발행 후) 확인 항목

1. 본문 워커·메신저 Top7 각주에 Free 모델 의견이 붙는지: `deepseek-v4-1-flash`(△)·`minimax-m3-1-flash`(○)·`mimo-v2-6-flash`(△) ✓.
2. 본문 오케스트레이터 Top7 각주에 `deepseek-v4-1-flash`(◎)·`glm-5-3-flash`(○)·`mimo-v2-6-flash`(×)·`minimax-m3-1-flash`(×) 가 붙는지 ✓.
3. 댓글 3개(워커 Top15)의 Free 모델 각주도 동일하게 붙는지 ✓.
4. **미확인 모델·관찰 없는 역할에는 각주가 생기지 않았는지**(빈 각주·잘못된 각주 없음) ✓.
5. 점수·순위·파레토·안내·각주 위치가 기준선(#229)과 동일한지(부분 변경 없음) ✓.
6. glm 계열(`glm-5-3`) 각주는 여전히 없음 → §4 후속 미해결로 동일 ✓(현행 유지).
