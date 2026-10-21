# #266 Free 매칭 진단 (w2 지원 · 읽기 전용, 2026-10-21)

- 범위: r 관측(① `minimax-m3.1-flash` vs 측정 `minimax-m3-1-flash` 키 불일치 ② O/R 이 측정 Free 를 점유하면 Beam 폴백이 구성 불가) 의 **판정**과
  **최소 수정 제안**(w1·r 대상) ✓. 소스·테스트 변경 0건 ✓ · 외부 쓰기·커밋·PR·발행 0건 ✓ · PostgreSQL·0.3.x 중단 유지 ✓.
- 재현 스크립트: `/tmp/diag-free-match.mjs` · `/tmp/diag2.mjs` (읽기 전용 · 실제 DB·외부 호출 없음 ✓).

## 1. 판정 요약

| 관측 | 판정 | 근거 |
| --- | --- | --- |
| ① 점(점) 키 불일치 | **제품 아님 · 하네스/평가자 입력 오류** ✓ | 공식 Free 카탈로그의 `modelId` 는 **canonical 대시형**(`minimax-m3-1-flash-free` ✓) 이고 `displayName`/`originalId` 만 공식 점형(`minimax-m3.1-flash-free` ✓) ✓ → canonical/alias 해석 후 `minimax-m3-1-flash` ✓ = 측정 id ✓ → **합집합 풀에서 측정 점수 매칭 성공**(실측: O 풀 `deepseek(62.9)·minimax(56)` ✓) |
| ② Beam 폴백 구성 불가 | **현재 union 구현에서는 재현 안 됨** ✓ | O/R 이 측정 Free 를 점유해도 **워커 슬롯이 미측정 Free(Beam 등)로 채워져 feasible=true** ✓(실측: `open-1+1+3` = O deepseek·R kimi-k3·W mimo/glm/**beam-free** ✓) → 구성 불가는 **후보 풀이 비었거나 작을 때만** ✓ → 평가자 픽스처(input) 부재 가능성 ✓ |
| ③ 빈 verified 카탈로그 | **기대 동작** ✓ | Free 카탈로그가 비어도 레지스트리 8개로 open 조합이 구성됨 ✓(실측 feasible=true ✓) → best 정책의 Free fallback 만 빈 상태 ✓ → 사유 문구는 '워커 1개 부족' 처럼 일반적 ✓(개선 여지) |
| ④ unverified `free:true` 승격 | **조합 경로에서 승격 없음** ✓ | CLI 관측 플랜은 `verified:false` ✓ → 조합 풀이 `m.verified` 로만 채움 ✓ → `observedOnly` 는 플랜에 미포함 ✓ → **미검증 Free 가 후보로 승격되지 않음** ✓ |
| ⑤ jev 제외 | **실제 결함(조합 풀)** ✓ | Free 표는 jev 접두를 제외 ✓(기존 규칙 ✓) → **합집합 워커 풀에는 `jev-1-13-free` 가 그대로 들어감** ✓(실측 ✓) → 유지 항목 'jev 제외' 와 불일치 ✓ |

## 2. 실측 근거 (핵심)

```
공식 Zen Free 목록:  modelId=minimax-m3-1-flash-free  displayName=minimax-m3.1-flash-free
canonical=minimax-m3-1-flash   aliasResolve=minimax-m3-1-flash   (측정 id 와 동일 ✓)
합집합 풀 O: deepseek-v4-1-flash(62.9), minimax-m3-1-flash(56)     ← 측정 점수 매칭 성공
합집합 풀 W: …, beam-free(미측정), big-pickle(미측정), jev-1-13-free(미측정), …
open-1+1+3: O deepseek / R kimi-k3 / W mimo / glm / beam-free   feasible=true
빈 카탈로그(레지스트리만): open-1+2 feasible=true (degradation 없음 ✓)
```

## 3. 관측 ① — 정확한 재현 절차 (평가자 입력 오류)

1. 공식 Free 페이지 id 는 점형(`minimax-m3.1-flash-free` ✓) → 그대로 픽스처 id 로 쓰면 점형 키가 들어감 ✗.
2. 제품 경로의 `modelId` 는 `canonicalFreeId` ✓ 로 대시형 정규화 후 매칭 → **점형 키는 표시명(`displayName`/`originalId`)에만 존재** ✓.
3. 따라서 평가자/하네스가 `displayName` 을 id 로 쓰면 키 불일치가 재현됨 ✗ → **입력 정규화 문제** ✓ (제품 결함 아님 ✓).
4. 기대 동작 ✓: 키는 `modelId`(canonical) 또는 `canonicalModelId(...)` ✓ 기준이어야 함 ✓ · 점수 매칭은 정상 동작 ✓(§2 ✓).

## 4. 관측 ② — O/R 점유와 미측정 워커 폴백

- 현재 규칙 ✓: O/R 풀 = **측정 점수 있는 후보만** ✓ · W 풀 = 측정 + 미측정(Beam 등) ✓ · 조합 내 canonical 유일 ✓.
- 결과 ✓: O/R 이 측정 Free 를 점유해도 워커는 미측정으로 채워짐 ✓ → feasible 유지 ✓ (실측 ✓).
- 남는 **정책 공백** ✓ (최신 사용자 범위 ✓): "워커 **1자리**는 verified Free 우선" ✗ → 현재 구현에 **예약 규칙이 없음** ✓ →
  미측정 모델이 **id 사전순**으로 경합 ✗ (Beam 이 `beam-free` 로 `big-pickle` 앞이라 우연히 선택 ✗) → **결정론적 슬롯 규칙 필요** ✓.
- 제안 ✓: W 슬롯 1을 "검증된 Free 중 미사용 최상위"로 **예약** ✓ → 나머지 슬롯은 자연 합산 최적 ✓ (O 강제·역할 가중치 추가 아님 ✓).

## 5. 최소 수정 제안 (w1 구현 대상 · r 검증 대상)

1. **합집합 풀에 jev 접두 제외** ✓ — Free 표와 동일 규칙 재사용 ✓ (`letter-markdown-free-table` 의 jev 필터 ✓).
2. **Free 제공 모델 표시** ✓ — 합집합 후보가 Free 카탈로그에서 왔으면 `free:true` 표시를 유지 ✓ (🆓 마크 ✓).
3. **워커 슬롯 1 = verified Free 우선** ✓ (예약 규칙 ✓ · Beam 은 그 다음 폴백 ✓ · 미측정 점수 생성 금지 ✓).
4. **사유 문구 분기** ✓ — Free 후보 부족(카탈로그 비어 있음/검증 없음)과 일반 후보 부족을 구분 ✓.
5. **평가자 입력 정정** ✓ (r 측 ✓) — Free id 는 `modelId`(canonical) 기준 ✓ (점형 `displayName` 금지 ✓).

## 5-1. 직접 협업 결과 (w2 · 2026-10-21 후속)

- **동일 입력 재현** ✓ — `/tmp/repro-266.mjs` (읽기 전용) → 4조합 수치·슬롯이 w3 evidence 와 **완전 일치** ✓
  (`best-1+1+3 347.10` · `best-1+2 206.95` · `open-1+1+3 310.82` · `open-1+2 178.27` ✓).
- **충돌 정리** ✓ — w3 의 "best1+2 Free 없음"(206.95 ✓) 은 **현재 src(워커 Free 예약 미구현)** 결과 ✓,
  r 의 201.90 은 **정책 적용 후** 기대값 ✓ → **상충이 아니라 적용 전/후 차이** ✓ · 제품·평가자 입력 결함 아님 ✓.
- **정책 적용 산술** ✓ — 206.95 − 64.40(haiku) + 59.35(minimax) = **201.90** ✓ (w3·r 기대값과 일치 ✓).
- **합의된 최소 수정** ✓ — F3 워커 verified Free 최소 1 제약(합산 최대는 제약 안에서 · O 강제·가중치 추가 없음 ✓) ·
  F2 Free 카탈로그 출처 표식 유지(🆓 ✓) · F1 합집합 풀 jev 접두 제외 ✓ · F4 사유 문구 분기 ✓ (구현: w1(p2) ✓).
- **평가자 수정** ✓ — F5 Free id 는 `modelId`(canonical) 기준(점형 `displayName` 금지 ✓) (검증: r(p7) ✓).
- **전달 완료** ✓ — `tmp/yoroi-266-free-matching-w1-packet.json` → w1(p2) ✓ · `tmp/yoroi-266-free-matching-r-packet.json` → r(p7) ✓ (coord send ✓).

## 6. 남은 확인 필요(실측 한계)

- 실제 발행 run 의 원시 Free catalog 응답을 보존한 로그가 없어 ✗, **점형 키가 어느 입력에서 들어왔는지**는 평가자 픽스처 확인이 필요 ✓ (r 측 ✓).
- 실제 데이터에서 DeepSeek 이 O 인지는 **합산 최적의 자연 결과** ✓ (강제 아님 ✓) → 다르면 #267 에서 역할별 점수·대안 조합·합산 차이 설명 ✓.
- 워커 슬롯 1 예약 규칙의 정확한 정의(예: "검증 Free" = 카탈로그 verified ✓ vs 레지스트리 ✓) 는 사용자 확인이 필요 ✓ → 제안만 ✓.
