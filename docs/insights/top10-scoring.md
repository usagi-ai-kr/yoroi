# 상위 10 지수 점수화 및 가성비 최적 존 설계 (2026-10-12)

Top 10 압축 레터의 오케스트레이터·워커 선정 및 가성비 최적 존(Cost-Efficiency Optimal Zone) 분석 공식과 설계 결정을 기록한다.

## 1. 혼합 단가 및 가성비 지수 공식

- **혼합 단가 (Blended Price per 1M tokens)**:
  `혼합 단가 = (3 × 입력 단가 + 1 × 출력 단가) / 4` (단위: USD / 1M tokens)
  일반적인 에이전틱 작업 흐름(프롬프트·문맥 3 : 생성 1)을 반영한 표준 가중치다.
- **가성비 지수 (Efficiency Index)**:
  `가성비 = 지수 ÷ max(혼합 단가, 0.01)`
  0으로 나누는 오류 방지 및 무료 티어 왜곡 완화를 위해 최저 단가 바닥($0.01)을 적용한다.

## 2. 추천 Effort 및 파레토 경계

- **추천 Effort**:
  동일 모델 제품군(Family: low/medium/high/xhigh 등) 내에서 지수 대비 비용 효율(가성비)이 가장 우수한 effort 변형을 권장안으로 표기한다.
- **파레토 경계 (Pareto Frontier, ★ 표기)**:
  "더 낮은 비용이면서 더 높은 지수를 기록하는 모델이 존재하지 않는" 최적 상태.
  어떤 모델 B도 `Price(B) <= Price(A)`이면서 `Score(B) >= Score(A)` (최소 하나는 엄격한 우위)를 만족하지 못할 때 모델 A를 파레토 최적(★)으로 지정한다.

## 3. 가성비 최적 존 선정 (가중합 폐기, 2026-10-12 사용자 결정)

- **폐기 사유**: 지표 가중합(지수 0.5·가성비 0.4·OR 0.1 등) 점수화는 상충 지표를 하나의 점수로 섞어 해석이 불투명하고, 저지수 고효율 모델의 진입이 가중치에 좌우됐다. "충분한 성능 중 가성비 순" 결정에 따라 임계 필터 + 사전식 정렬로 교체했다.
- **임계**: 오케스트레이터는 그룹 대표의 intelligence_index ≥ 후보 최고값의 85%, 워커는 coding_index ≥ 후보 최고값의 75%인 그룹만 남긴다(경계 포함). 상수는 `src/insights/letter-top10-worker.ts`의 `OPTIMAL_ZONE_THRESHOLDS` 한 곳에 둔다.
- **정렬**: 가성비(지수÷혼합 단가) 내림차순. 무료(0/0)는 최상위, 단가 미상은 맨 뒤(★파레토 보류). 동률이면 OpenRouter 사용량 순위 → 지수 순.
- **채우기 금지**: 통과 그룹이 10개 미만이면 그대로 표시한다.
- **전일 비교**: 전일 코호트도 같은 정책(임계+가성비+OR 동점)으로 재계산한다(`previousRanks`).

## 표시·비교 정책 보강 (2026-10-12)
- 가격 결측: 입출력 단가가 모두 finite>=0일 때만 혼합단가를 계산하고, 한쪽이라도 결측/음수면 '단가 -'·가성비 n/a로 표시한다(0 대입 금지). 0/0만 무료. 가격 미상 모델은 ★파레토 보류(false).
- 대표 effort: 동일 family에서 가성비가 가장 좋은 변형을 대표로 쓰고, 다른 변형은 효율순 상위 3개(+외 N개)를 같은 행에 나열한다.
- 전일 비교: 동일 최적 존 정책으로 재계산하며, 현재 OR 참고를 쓰면 전일 동일 scope/schema OR 자료(최신 comparisonDate, aggregate/other 제외)를 반드시 함께 전달하고, 없으면 추정 비교 대신 보류하고 사유를 표기한다.
- 푸터는 공식 1줄과 정렬 규칙 1줄('가성비 순(무료 최상위) → OpenRouter 사용량 → 지수, 단가 미상 후순위 · ★ 정의')로, 상단은 '가성비 최적 존: 지수 ≥ 최고의 85%(오케스트레이터)/75%(워커) 중 가성비 순 · ★ 파레토 최적'으로 표기한다.
- 길이 예산 3,600자(2026-10-12 이중 목록 실측 기준 상향: 두 목록 10+10 행의 최악 실측 3,933자 → 참고순위 생략 후 3,469자): 초과 시 표시 이름만 24자로 우선 축약(원문 저장 유지)하고, 그래도 초과하면 변형→참고순위 순으로 생략하며 실제로 생략한 단계에만 안내 줄을 덧붙인다. 행 중간 임의 절단은 하지 않는다.

## 4. 후보 필터와 파이프라인 순서 (rank-rules-103, 2026-10-12)

- 후보 50 전체를 처음부터 다시 산출한다(기존 Top10 재정렬 금지): **제외 필터 → 최신 버전만 → off-peak 단가 적용 → 단가·가성비 계산 → 성능 하한(85%/75%, 필터 후 후보 최고값 기준) → 정렬**.
- **제외 계열**: 모델명에 `fable`·`astra` 포함 시 순위·참고 모두 제외. `grok` 계열도 제외하며 사유는 **사용자 취향**이다.
- **동일 계열 최신만**: 꼬리 숫자 버전을 비교해(예 `claude-opus-5-5` > `claude-opus-5`) 더 높은 버전이 후보에 있으면 구버전을 제외한다. 버전 파싱 불가·동일 버전·판단 불확실 시에는 제외하지 않는다(오판 방지, `letter-top10-filter.ts`).
- **벤더 라인 세대 교체 (gpt-gen-112, 사용자 지시 2026-10-12)**: 세대 비교 기준은 등급을 뺀 **벤더 라인**이다(`vendorLine`: 계열 키에서 등급 토큰 `luna`·`terra`·`sol`을 제거해 `gpt-luna`·`gpt-terra`·`gpt-sol`이 모두 `gpt`가 된다). 같은 라인에 더 높은 세대(예 `gpt-6-1-sol`의 6.1 > `gpt-5-6-luna`·`gpt-5-6-terra`의 5.6)가 후보에 있으면 낮은 세대의 모든 하위 등급을 제외한다 — GPT의 luna·terra·sol이 같은 세대의 하위 등급이기 때문이다. 등급이 곧 라인인 `claude-opus`·`claude-sonnet`·`claude-haiku`·`gemini-pro`·`gemini-flash`는 각자 유지한다(haiku를 opus 세대로 지우지 않는다). `GRADE_TOKENS`에 없는 등급은 파싱 불확실로 보아 제외하지 않는 기존 원칙을 지킨다. 요금제상 최적 표도 같은 `filterCandidates`를 쓰므로 동일하게 적용된다.
- **현재 세대 제외 기준 (gpt-pool-113, 2026-10-12)**: GPT 6.x가 있으면 AA 기록이 있는 전체 접근 가능 모델 집합에서 지표와 무관하게 한 번 세대를 판정해 GPT 5.6 luna·terra·sol 제외 목록을 만들고, 오케스트레이터·워커·요금제상 최적에 공통 적용한다.

## 5. off-peak 단가 override

- `src/insights/model-price-overrides.ts`의 `OffPeakRate`(input/output 단가, sourceUrl, checkedOn)에 **공식 요금 문서로 확인된 값만** 넣는다. 추측값 금지.
- DeepSeek 4.1 Flash: 공식 off-peak 문서 미확보(HTTP 0)로 값 없이 `OFF_PEAK_TODO`에 **미확인**으로 남긴다.
- 적용 시 혼합 단가·가성비 계산에 off-peak 단가를 쓰고 행에 `off-peak`를 표기한다.

## 6. 속도·캐시 지표 반영 여부 (AA 저장분 읽기전용 확인, 2026-10-12)

- `median_output_tokens_per_second`: 70개 모델 저장 확인 → 가성비 동률 tie-break에 사용(순서: 가성비 → OR 사용량 → **속도** → 지수).
- `price_1m_cache_hit_tokens`(73)·`price_1m_cache_write_tokens`(48)는 존재하나 캐시 적중률 데이터가 없어 가성비 계산·표기에 **미반영**(근거: 적중률 없이 캐시 단가만으로 유효 비용을 계산할 수 없음).
- 그 외 속도 지표(응답시간 등)는 tie-break에 미반영.

## 7. 요금제상 최적 (plan-optimal-104)

- 요금제→모델 매핑은 `src/insights/plan-catalog.ts`에만 두고, 각 항목은 레포 근거 `source`와 `verified`를 가진다. `verified=false`(모델 단위 근거 부족)와 근거 없는 모델은 렌더에 쓰지 않는다(근거 없는 모델은 보고서 '미확인'에만 기록).
- 후보는 AA 저장 모델과 **정규화 이름 정확 일치**만 사용하고, #103 최적 존 파이프라인(`letter-top10-filter`·`letter-top10-worker`)을 수정 없이 재사용해 임계(85%/75%, 전체 후보 최고값 기준)를 적용한다.
- **정렬 판단**: 정액 구독은 모델 선택에 따른 한계비용이 0이므로 가성비(지수÷단가)와 단가 정렬은 의미가 없다. 따라서 임계 통과 후보를 **지수 내림차순**으로 표시한다(요금제별 최대 3위). 사용 한도가 매우 적은 모델(예: Kimi K3 440회/5h)은 요금제상 최적 표에서 `(제한 N회)`를 병기한다.
- 압축·마크다운 렌더 모두 `## 요금제상 최적` 섹션을 제공한다(마크다운은 `renderPlanOptimalMarkdown`, 압축은 `renderPlanOptimalLines`).
- 요금제 접근 표기(`접근 플랜명`): 공식 페이지에서 확인된 요금제 사용 방식(크레딧: `Ollama Cloud Pro(크레딧 $60/월)`) 및 모델별 사용량 제한(N회/기간: `OpenCode Go Plus(440회/5h)`)을 병기해 오해를 방지한다. Top10 정렬에는 영향을 주지 않는다.

## 8. 요금제 가격 확인·off-peak 및 사용 한도 규칙 (plans-pricing-104, kimi-limit-112, ollama-credit-112, 2026-10-12)

- 보유 요금제 5개만 다룬다: ChatGPT Plus, Claude Pro, Google AI Pro, Ollama Cloud Pro, OpenCode Go Plus(Zen Free 제외 — 사용자 확정). 공식 페이지를 1회씩 읽기 전용 조회해 확인했다: openai.com/chatgpt/pricing/, anthropic.com/pricing, one.google.com/about/google-ai-plans/, ollama.com/pricing, opencode.ai/go. 각 항목은 `sourceUrl`·`checkedOn(2026-10-12)`·`verified`로 기록하고, 페이지에서 확인되지 않은 모델은 코드에 넣지 않는다(보고서 '미확인').
- **사용 한도 및 단가(kimi-limit-112, ollama-credit-112)**:
  - OpenCode Go Plus: Kimi K3는 5시간당 440회 추정 제한(Plus 기준, 월 $60 상당)이 공식 명시되어 `usageLimit`에 기록하고 표기(`OpenCode Go Plus(440회/5h)`)한다.
  - Ollama Cloud Pro: 요금제 수준에 사용 방식(credit: $60/월, 토큰 단가 차감, concurrency 3, sourceUrl: ollama.com/pricing)을 기록하고, 레터 접근 표기에 `Ollama Cloud Pro(크레딧 $60/월)`로 표기한다. 모델 단가는 기존 AA/공식 단가(Kimi K3: 입력 $3.00, 출력 $15.00/1M)를 사용하며 혼합 단가 $6.00/1M에 정상 반영된다.
- off-peak 창은 공급자별로 다르다: DeepSeek 플랫폼 peak=월–금 UTC 01:00–04:00·06:00–10:00(중국 공휴일 제외), 그 외·주말·공휴일 off-peak(반값). Ollama Cloud peak=평일 UTC 12:00–18:00, off-peak=평일 그 외+주말 전일. 두 창을 하나로 묶지 않는다.
- 적용 규칙: 레터 발행 시각 09:00 KST = 00:00 UTC는 두 공급자 모두 off-peak 창이므로, DeepSeek 4.1 Flash(V4.1-Flash) 혼합단가·가성비에 off-peak 단가(입력 $0.15/출력 $0.60, cache miss)를 사용하고 행에 `off-peak`를 표기한다(OpenCode Go 경유 포함). 발행 시각이 바뀌어 peak 창에 들면 재검토한다.
- Ollama의 다른 모델은 off-peak 단가가 공개되지 않아 미확인(적용 안 함). 캐시 적중 단가는 §6대로 가성비 계산에 미반영한다.
## 9. 역할별 두 목록 (dual-list-111, 2026-10-12)

- 0.8.0의 통합 Top10(#108)을 폐기하고 **🧭 오케스트레이터 Top10**·**🛠️ 워커 Top10** 두 목록으로 되돌렸다. 후보 풀·필터·군집화·임계는 공유하고 판정과 정렬만 목록별로 독립 수행한다.
- `selectOptimalZone(groups, 'orchestrator')`(지수 ≥ 후보 최고 85%)와 `selectOptimalZone(groups, 'worker')`(코딩 ≥ 후보 최고 75%)를 각각 호출해 상위 10을 뽑는다. 목록 간 상호 배제가 없어 교집합 모델은 두 목록에 모두 오르고 모델 칸 뒤에 `↔`를 붙인다.
- 전일 비교·이탈도 목록별로 재계산한다. `previousRanks`는 `Record<역할, Map<정규화 모델명, 순위>>`를 반환하고, 압축·마크다운 공식 절은 그 두 벡터를 함께 쓴다.
- 압축·마크다운 모두 `## 🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)`·`## 🛠️ 워커 Top10 (실행·코딩 / Coding Index)` 두 섹션이며 표 열은 `순위·모델·추천 effort·지수·혼합 단가·가성비·접근 요금제·변동` 8열이다. 역할이 갈라졌으므로 `추천 역할` 열은 폐기했다.
- 순위는 목록 내 위치 기반(1..N)이고, 가성비 동률은 목록별 costEfficiency 순위를 그대로 쓴다(전일 코호트와 순위 기준이 일치한다).
