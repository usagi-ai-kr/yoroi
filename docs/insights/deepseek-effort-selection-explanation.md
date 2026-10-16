# DeepSeek effort `high` 표기 원인 조사 (w1, `yoroi-deepseek-effort-policy-w1`, 2026-10-16)

- 질문: max가 허용되는데 레터가 왜 `deepseek-v4-1-flash`를 high로 두나? (게시 전 확인 단위, 읽기 전용)
- 방식: clean 1.0.2(후보 = 커밋 `44253ed`) vs ROOT 1.1 dirty `letter-top10-score.ts` 실제 diff + 저장 공개 스냅샷 특정 행만. 개인 usage·전체 dump 없음. **source/test/문서 수정 없음**.

## 데이터 (2026-10-16 스냅샷 특정 행)

- **AA**: `deepseek-v4-1-flash`는 **Max만** 측정 — 별칭 `(Max)`, AA Intel 39.5, 179.25 t/s, cost/task 0.2652, 단가 $0.3/$1.2. AA에 High 행 없음(non-reasoning은 별도 id 24.7).
- **Cognition**: `DeepSeek V4.1 Flash`는 **high만** — v1_1/high/main correct 0.4863·cost $0.6202·44.67분(extended 0.6203). low/medium/max 없음.
- **OR**: `deepseek/deepseek-v4.1-flash-20260910` total_tokens(usage) · **OCD**: `deepseek-v4.1-flash` 토큰행.
- effort 파싱: 별칭 `(Max)` → `max`(`letter-top10-group.ts:38-41`). 가중치·선택 코드는 clean 1.0.2 그대로(수정 없음).

## 코드 원인

- **오케스트레이터**: 관측 effort {high(Cog), max(AA)}를 각각 대표 변형으로 평가하고 **최고 점수**를 고른다(`letter-top10-score.ts:38-43,50-82`, `orchestratorVariants`). high 조합(성능 0.4863·속도 44.67분·$0.62/task·usage 100)이 max 조합(39.5·179 t/s·$0.525 기반 I/(P+.01))보다 composite 70/5/10/15 점수가 높아 대표가 high가 됐다. **max는 제외가 아니라 평가 후 탈락**이며, effort 단위로 max를 제거하는 필터 코드 경로는 없다(`filterCandidates`는 계열 제외·off-peak 단가만 처리).
- **워커**: `m = c>a ? cogEffort : aaEffort; effort = best(m)`(`score.ts:40-43`) — Cog 표준값이 커서 chosen = high(Cog) → 라벨 `high`. 그러나 표시 AA 지수는 `r.aaEffort?.get('high') ?? best(aaEffort)` = **AA Max 39.5**(`score.ts:71`) — **라벨(high=Cog)과 값(max=AA)의 소스 불일치**가 실제로 있는 상태다(레터 워커 4위 high + 39.5).
- 오케 ▽9행은 AA 지수 `-`·성능 75/속도 30/가성비 53 모두 high(Cog)+usage 값으로 일관 — 오케 쪽은 라벨-값 불일치가 아니라 점수 선택 결과다.

## ROOT 1.1 dirty와의 diff 관계·최소수정 범위

- 1.1 hunk(`aaFallback`)는 워커 선택에 "chosen effort가 AA에 없으면 AA 최선 effort로 **라벨을 맞춘다**"를 추가한다(`score.ts:42`). 적용 시 워커 라벨은 `max`(값 39.5와 일치)가 된다. **오케 선택 로직은 1.1도 동일**(hunk 미접촉) — 오케 high는 점수 결과로 남는다.
- 최소수정 범위: ①(라벨 정합) 워커 fallback 수준의 **1줄성 변경** — DeepSeek 라벨/선정만 별도 수정 가능, 1.1 전체(orchestration·정책 문서) 불필요. ②(오케 추천을 max로) 점수·가중치 정책 판단 사항(버그 아님)으로 별도 논의. **실 dirty를 release에 일괄 포함하지 않는다.**

## 결론·게시 조건

- `high`는 capability 상한이 아니라 **측정 조합(AA=Max만·Cog=high만) + 점수 선택 + (워커)라벨-값 소스 불일치**의 결과다. "high 상한"이라는 근거는 없다. **사용자 max 허용**과 **AA 측정 부족/소스 매칭**은 별개다.
- 게시 선택지: (i) 현 1.0.2 그대로 게시 + 라벨 의미 caveat, (ii) 워커 라벨 최소수정 후 릴리스 소스 재고정·재검증, (iii) 오케 정책 변경은 별도. **최종 결정·발행은 사용자/오케 — 이 단위는 조사·보고만**하고, 최종 letter 발행은 이 문제 확인 후 별도 패킷.

## 준수

- 소유 docs/JSON만 작성(≤100줄). source/tests/Git/GH 변이·게시·tag/Release/global 없음. env·개인 usage·raw 0. 검증: validate-repo PASS.
