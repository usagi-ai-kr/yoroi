# #229 재발행 검증 (2026-10-21, w3)

- 대상: 신규 레터 **#229** (2026-10-21T00:26:15Z 발행, 라벨 `letter`, OPEN) — 읽기 전용 확인.
- 기준: `docs/insights/letter-225-republish-baseline-20261021.md` §3 검증 체크리스트 1~8 + 이전 레터 링크 항목.
- **종합 판정: PASS (8항목 중 7 완전 통과 · 1항목 부분 어긋남)** — 구조·형식·출처는 충족, **usagi 각주 커버리지에 BLOCK 1건**.
  외부 수정·재발행·댓글 작성 없음 ✓ · 소유 문서만 작성 ✓.

## 1. 항목별 결과

| # | 체크리스트 | 결과 | 근거(행·문구) |
| --- | --- | --- | --- |
| 1 | 본문 3역할 표 3개 각 7행 | PASS | `🧭 오케스트레이터 Top7`(7행) · `🔍 리뷰어 Top7`(7행) · `🛠️ 워커·메신저 Top7`(7행), 열은 `순위·파레토·모델·스코어·effort`(비고 열 없음) |
| 1b | usagi 각주 | **BLOCK(부분)** | 각주 형식은 정상(`> claude-sonnet-5-5: usagi △ · 오케 관찰 1회뿐…`). 그러나 **워커·오케 역할의 Free 모델 정성 의견이 누락**: 워커 Top7 각주에 `muse-spark-1-3`만 있고 `deepseek-v4-1-flash`(△)·`minimax-m3-1-flash`(○)·`mimo-v2-6-flash`(△) 없음, 오케 각주에 `deepseek-v4-1-flash`(◎) 없음 |
| 1c | 3역할 전용 안내 | PASS | 안내 3줄만: `👍 파레토 최적` / `스코어·effort 는 표시된 값 그대로(effort=추천 추론 강도, -=근거 없음)` / `usagi = 2026-10-20 정성 운용 관찰(점수 아님)` + 출처 URL. 2역할 전용(0~100 차원·▽하한·`*`·+N·🔒) 없음 ✓ |
| 1d | 산출 공식·출처 details 보존 | PASS | `<details><summary>출처 및 산출 공식</summary>` 유지, 산출 공식·실패 소스 안내·경고·출처 5종 그대로 |
| 2 | 댓글 3개 o15/r15/w15(+Free), 각 15행 | PASS | 댓글1 `오케스트레이터 Top15` 15행 · 댓글2 `리뷰어 Top15` 15행 · 댓글3 `워커·메신저 Top15` 15행 + `🆓 Free 티어` |
| 3 | Free 표 8열 머리 + 리뷰어 칸 | PASS | 머리 `| 모델 | 오케 | 리뷰어 | 워커 | AA 지수 | Zen | Go | 비고 |` ✓. 리뷰어 칸: deepseek `✓ 0.74` · minimax `✓ 0.68` · glm `✓ 0.66` · mimo `✓ 0.60`, 나머지 10행 `-` (근거 없는 값 없음) |
| 4 | 별칭 4건 각 1행 | PASS | `deepseek-v4-1-flash`·`glm-5-3-flash`·`mimo-v2-6-flash`·`minimax-m3-1-flash` 각 1행, 별도 `-free` 행 없음(중복 행 0) |
| 5 | 미확인 행·점수 생성 없음 | PASS | beam·big-pickle·exo·jev-1-13·ll-alpha·longcat-2-5-preview·mimo-v2-5·nemotron 3종 → `✗ / - / ✗ / -`(오케·리뷰어·워커·AA 지수), 다른 행 점수 빌려오기 없음 |
| 6 | Free 각주 유지 | PASS | 각주 3줄 유지 — Zen/Go 정의 · `OpenCode Zen Free: 기간 한정 무료…` · `OpenCode Go Free: Unlimited·기간 한정…` |
| 7 | partial·출처 표기 | PASS | 배지 `status 2_partial-warning` · 실패 소스 안내 `⚠️ 부분 수집 소스: artificial-analysis, arena-coding` · 출처 5종 · ⚠️ 경고 4건 + `⚠️ Free 목록 출처: 공식 페이지 Free 표기 확인(live, 2026-10-20)` |
| 8 | 비밀값 미노출 | PASS | 본문·댓글 3개 전체에 키·토큰·인증 헤더 없음 ✓ |
| 9 | #225 close + 후속 링크 댓글 | PASS | #225 CLOSED(2026-10-21T00:25:28Z) · #225에 후속 링크 댓글 1건(`갱신된 Free 리뷰어 로직으로 후속 레터 #229를 발행해 교체했습니다…`) ✓ |

## 2. BLOCK 1건 — 워커·오케 역할의 Free 모델 usagi 각주 누락

- **현상**: #229 본문 `🛠️ 워커·메신저 Top7` 각주 = `muse-spark-1-3` 1건뿐. 기준선 #225(2역할 비고 열)에는
  `deepseek-v4-1-flash △`·`minimax-m3-1-flash ○`·`mimo-v2-6-flash △`·`glm-5-3-flash ◎` opinions가 있었다 ✗ → **정보 손실**.
- **원인(확인)**: `letter-three-role-render.ts` 의 각주 조회가 원본 id 를 쓴다(`roleFitNote(entry.modelId, role)`).
  워커·오케 항목 id 는 공식 Free 카탈로그 id(`…-free`)이고, `roleFitBaseId` 는 effort 접미만 제거한다 → `normalizeModelName('deepseek-v4-1-flash-free')` = `deepseek-v4-1-flash-free`
  → `config/model-role-fit.json` 의 base 키와 불일치 → note 미확인. 리뷰어 역할은 후보 id 가 AA 원형이라 정상 표시 ✓.
- **재현(로컬)**: 합성 composition 실행에서 워커 섹션에 `minimax-m3-1-flash` 행은 있으나 워커 각주 없음, 리뷰어 섹션은 `> minimax-m3-1-flash: usagi △ · …` 정상 ✓.
- **권고 수정(소유 외 → 보고만)**: `roleFitBaseId` 가 `-free` 접미도 제거하도록 보정(설정 키는 AA base) 1줄 수준 ✓.
  별도 차종: `glm-5-3`(표)과 설정 키 `glm-5-3-flash` 불일치 → 별도 id 정규화 필요(보고) ✓.

## 3. 관찰 (차단 아님)

1. **Free 표 역할 점수와 3역할 표 점수가 다름**: Free 행 deepseek `오케 ✓ 68.0 / 워커 ✓ 53.2` vs 본문 오케 Top7 deepseek `62.9` · 워커 Top7 deepseek `57.6`.
   Free 표는 레터의 2역할 top10 목록 점수를 쓰고 3역할 표는 별도 파이프라인 점수(스코어 공간 상이) → 상호 교차 검증 불가. 표시 혼선 여지 → 보고 ✓.
2. **기준선 대비 AA 지수 채움 개선**: #225는 minimax만 `42.7` 이었으나 #229는 `minimax 42.7`·`glm-5-3-flash 41.8`·`mimo-v2-6-flash 37.9` 확보 ✓(deepseek만 `-` = 해당 실행 입력의 AA 인덱스 결측, 렌더 결함 아님 ✓).
3. **Arena 코딩 표기 형식 변경**: #225의 `⚠️ Arena 코딩 근거(성능 추가 근거·점수 미반영…)` 경고 문구가 사라지고 `부분 수집 소스: artificial-analysis, arena-coding` 로 이동 ✓(정책 변경 아님) → 배지 1→2 partial ✓.
4. **발행 시각**: #229 = 2026-10-21T00:26:15Z(KST 09:26) ✓. 기존 #225 = 2026-10-20T15:29:45Z ✓.

## 4. U2/U3 로 넘길 위험

- **[BLOCK]** 워커·오케 역할의 Free 모델 usagi 각주 누락(위 §2) → 다음 발행부터 opinions 손실 지속 ✗ (수정 1줄 + 회귀 테스트 필요).
- **[주의]** Free 표 역할 점수와 3역할 표 점수의 스케일 차(§3-1) → 사용자가 "같은 모델 다른 점수"로 오독 가능 → 안내 문구는 w1 소유(보고만).
- **[주의]** `glm-5-3` vs 설정 키 `glm-5-3-flash` 불일치 → 일부 opinions 계속 누락.
- **[확인]** deepseek Free 행의 AA 지수 `-` 는 입력 결측인지 렌더 결함인지 분리 불가(기준선 §4 그대로) → 보존된 실행 입력으로 분리 필요.
- **[없음]** 구조·형식·출처·비밀값·이전 레터 링크 항목은 모두 통과 ✓ → 다음 발행 차단 사유 없음 ✓.

## 5. 검증 게이트 상태 (보고)

- `python3 scripts/validate-repo.py` → **exit 1**: 라인 초과 3건(`src/insights/letter-top10-score.ts` 108줄 · `letter-top10-unified.ts` 116줄 ·
  `letter-top10-worker.ts` 102줄) — 전부 **다른 레인(워커 점수 가중치 변경 인-flight)** 파일 → 소유 외 수정 금지로 **미수정·보고만** ✓.
  내 소유 문서는 50줄로 라인 위반 없음 ✓. `git diff --check` clean ✓ · 커밋·push·이슈 쓰기 0건 ✓.
