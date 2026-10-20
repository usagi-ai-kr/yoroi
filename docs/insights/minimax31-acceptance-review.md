# MiniMax M3.1 Flash catalog 변경 독립 리뷰 (2026-10-20)

- 리뷰: w3(w18:p4). 대상: w1의 MiniMax M3.1 Flash catalog 작업
  (`src/insights/plan-catalog.ts`, `src/insights/model-aliases.ts`, `tests/insights-minimax31-catalog.test.ts`,
  `docs/insights/minimax31-catalog-fix.md`) + 보고서 `/tmp/yoroi-minimax31-catalog-report.json`
  + 후속 `/tmp/yoroi-minimax31-regression-checker-review-report.json`.
- **카탈로그는 읽기 전용 — 수정 0건.** 본 문서만 기록. 커밋·원격 쓰기 없음.
- 상태: **완료된 리뷰로 인수** (2026-10-20, 후속 패킷에서 중복 검증하지 않음). 아래 내용은 당시 판정 기록이며 이후 재검증 대상이 아니다.

## 1. 판정: PASS (차단 없음) + 잔여 확인 1건

| 확인 항목 | 결과 | 근거(직접 확인) |
| --- | --- | --- |
| 접근(계획) 범위 | PASS | `opencode-go-plus` 계획에만 추가. 공식 Go 문서에서 Go·Go Plus **양쪽** 제공 표기("Both Go and Go Plus provide access to these models")이므로 "Go/Go Plus" plan 하나로 표기해도 범위 과다 아님. 다른 계획(ChatGPT·Claude·Google·Ollama·Antigravity·Cursor·SuperGrok) 무변경 |
| effort 표기 | PASS | 항목에 effort 주장 없음(엔트리에 effort 필드가 없음). effort 가용성은 별도 설정(`config/effort-availability.json`) 영역 — 여기서 값·근거를 지어내지 않음 |
| free 단기 표기 | PASS | `free: true` + note "OpenCode Go/Go Plus · Free(limited time)". 공식 문서 "MiniMax M3.1 Flash Free: Free for a limited time"·가격 Free·월 한도 Unlimited과 일치. **유료·정식 제공으로 승격하지 않음** |
| alias ↔ AA id 매칭 | PASS | 명시 alias `minimax-m3-1-flash-free` → `minimax-m3-1-flash`(basis·checkedOn 2026-10-20·sourceUrl `opencode.ai/v2/docs/console/go` 포함). AA 정규화 id는 `minimax-m3-1-flash`이며 **10/20 수집분 AA에 intelligence_index·가격·속도 행이 실재** → 후보풀 `accessible` 게이트가 풀려 다음 레터에 반영 가능 |
| Space Bunny 별도 유지 | PASS | `space-bunny`를 별도 id로 유지(병합·대체 없음) + note "MiniMax M3.1 Flash 초기 버전(별개 id 유지, 병합 아님)". resolveModelId('space-bunny')가 그대로 반환하는 회귀 테스트 있음 |
| 기존 항목 비파괴 | PASS | diff 상 `space-bunny`는 modelId·displayName·sourceUrl(OPENCODE)·checkedOn·verified를 그대로 두고 note만 추가. `MiniMax M3`·`Kimi K2.7 Code` 등 나머지 목록 무변경. 모델 수·중복 없음 테스트 통과 |
| 미확인 표기 | PASS | w1 보고서대로 안정/preview 구분 없음("스페셜·preview·Space Bunny 구분 유지"), 배치도 점수 이식 없음("배치·점수 이식 없음") |

## 2. 잔여 확인 1건(차단 아님)

- **Space Bunny의 현재 제공 여부 미확인**: 2026-10-20 기준 OpenCode Go 공식 문서 모델 목록에는 `MiniMax M3.1 Flash Free`가 있고 **Space Bunny는 없다**.
  카탈로그의 `space-bunny`는 checkedOn 2026-10-12 시점 확인분이며, 무료·한정 제공 항목이 교체되어 빠졌을 수 있다.
  이번 변경은 이를 삭제하지 않고 note만 추가했으므로 **비파괴 원칙에 부합**한다. 제공 종료 판단은 제품 결정이며 리뷰 범위 밖 — 후속 확인으로 남긴다.

## 3. 선행 리뷰 지적의 처리 확인

- w1 자체 보고: 전체 check에서 기존 `insights-plan-catalog.test.ts` 1건 실패(`freeOnlyModelIds() []` 기대값이 `free:true` 항목과 충돌) — 제품 로직이 아니라 **기대값 문제**로 판단.
- 후속 리뷰(`minimax31-regression-checker-review`)가 기대값 3건을 교체(삭제·위반 없음)해 focused 10/10 통과. **제품 로직은 변경되지 않았음**을 diff로 확인.

## 4. 검증 (실측 exit)

- `node --import ./tests/harness-setup.mjs --import tsx --test "tests/insights-minimax31-catalog.test.ts" "tests/insights-plan-catalog.test.ts"` → **10 pass / 0 fail, exit 0**
- `pnpm run typecheck` → **exit 0**(해당 파일 오류 0건).
- `python3 scripts/validate-repo.py` → **FAIL 1건: `src/insights/plan-catalog.ts` 101줄 > 100**. **원 작성자 w1에게 별도 교정 예정**(본 리뷰는 파일을 수정하지 않음). 나머지 파일은 100줄 이하.
- `git diff --check` → exit 0. 커밋·push·PR·원격 쓰기 0건. 실모델 호출 0건.
- 전체 `pnpm run check`는 총괄이 마지막에 1회 실행(중복 금지).
