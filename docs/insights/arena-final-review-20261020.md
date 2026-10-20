# Arena 단위A 최종 독립 리뷰 (2026-10-20)

- 리뷰: w3(w18:p4). 요구: `docs/insights/issue-followup-20261020.md` §w2 + `arena-source-check-20261020.md`.
- 대상: w1 Arena 5파일(`src/insights/arena-coding-{types,parser,model}.ts`, `tests/insights-arena-coding-parser.test.ts`,
  `docs/insights/arena-coding-unit1.md`) + 수정 보고서 `/tmp/yoroi-20261020-arena-source-fix-report.json`.
- **결론: PASS — 차단 없음. 코드 수정 0건.** 단 문서 정정 1건(아래 4-1)과 다음 단위 요구 3건을 남긴다.

## 1. 공식 근거 (실제 조회 1회, 2026-10-20)

- 조회 URL: `https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset` — **정확함·접속 가능**(Dataset `lmarena-ai/leaderboard-dataset`, parquet, CC-BY-4.0).
- 확인된 사실: ① `webdev (Code Arena)`·`agent (Agent Arena aggregate)` ② 카드 per-signal 나열 =
  `agent_bash_recovery_steps`·`agent_praise_complaint`·`agent_steerability`·`agent_task_outcome_explicit`·`agent_tool_hallucination`
  ③ rating = Bradley-Terry Arena Score(float)·agent `score` = IPS(τ̂)(float) ④ 뷰어 `score` 범위 **-0.2 ~ 0.19**,
  실측 음수행(Grok 4.6 -0.002208·GPT-5.5 -0.002134·Solar Pro 4 -0.200582) → 0~1 성공률 해석은 틀림 ⑤ **행 스키마에 `subset` 열 없음**
  (사용법 예시상 subset은 dataset config 인자) ⑥ 카드의 category 설명 "overall, coding, math"·agent 뷰어 category classes=1('overall')
  ⑦ split `latest`(52행) / `full`(1.79k행) ⑧ 실데이터 model_name 50개 표본 확보.
- 미확인(추측 금지): per-signal bash 서브셋의 개별 컬럼 목록(카드 agent 스키마는 일반 표이고 `session_count`는 "aggregate subset only"로 표기 → 개별 구성은 추론 잔존)·
  webdev 행의 개별 컬럼 목록(카드 일반 스키마 표 기준)·발행 주기·agent 카테고리 값 집합 전체.

## 2. 판정 결과 (요구 항목별)

| 항목 | 결과 | 근거 |
| --- | --- | --- |
| allowlist = webdev + agent_bash_recovery_steps만 | PASS | types:9-12. 테스트가 `agent`·`agent_bash_reliability`·`agent_bash_reliability_no_prereq`·`agent_tool_hallucination`·`text`·`vision`·`unknown`·undefined 8종 거부(테스트:49-57) |
| subset은 transport 인자 | PASS | 파서 시그니처 `parseArenaCodingRow(input, subset)`(parser:40), 행 타입에 `subset` 없음(types:19-45). 조회 확인 "행 스키마에 subset 열 없음"과 일치. 행이 `subset`을 담아도 transport가 우선(실측) |
| IPS 음수 보존 | PASS | `num()`은 유한수만 통과·클램프 경로 없음(parser:16-17). 실측 -0.42 → value -0.42, 음수 CI -0.016144 보존, 실데이터 -0.2 범위와 정합 |
| qualifier·subset·category 복합 식별 | PASS | `arenaCodingIdentityKey`=source\|subset\|category\|base\|effort\|qualifier(model:33-36). 실측 4케이스 키 상이: `…\|high\|20260813` / `…\|high\|-` / `…\|agent_bash_recovery_steps\|…` / `…\|other\|…`. 실데이터 'DeepSeek-V4-Pro (High, 20260813)' → base `deepseek-v4-pro`+qualifier `20260813` |
| 7개 집중테스트 의미검증 | PASS | 7/7 pass(exit 0). 삭제된 aggregate·reliability 거부 포함. 실데이터 표본 50개로 toBaseId→catalog 일치 33건(미일치 17건은 전부 catalog 미등재 모델·`fable` 제외 패턴·`gemini-3-1-pro-preview`(기존 alias로 해석) — id 오류 아님) |
| 유사명 무병합 | PASS | 'Muse Spark 1.1'↔'Muse Spark 1.3', 'GPT-5.5'↔'GPT-6 Astra' 상이 유지. toBaseId는 숫자구간 점만 하이픈(일관) |
| 실제 DB·once 미연결 | PASS | 5파일 import에 store·once·sqlite 없음. model.ts는 행 계약만(한계: §4-2) |
| `splitBaseAndEffort` 호환 주장 | PASS | model:17-20 주장의 근거 확인: 'claude-opus-5-5-max'→{base,effort:max}, 'grok-4-7-xhigh'→xhigh, 'kimi-k3'→default |
| 출처 URL·확인일·스키마·미확인 문서화 | 조건부 PASS | unit1.md:8-17 — 필드 목록은 조회와 일치. 단 4-1의 1항 정정 필요 |

## 3. 검증 명령·exit

- `node --import ./tests/harness-setup.mjs --import tsx --test tests/insights-arena-coding-parser.test.ts` → **7 pass / 0 fail, exit 0**
- `pnpm run typecheck` → **exit 0**(w1이 이전 TS2367 오류를 수정해 clean). `python3 scripts/validate-repo.py` → **PASS: 818 files, 8 skills, exit 0**.
- `git diff --check` → **exit 0**. 5파일 줄 수 37/68/61/74/36(≤100).
- 전체 `pnpm run check`는 w1 단위 담당이라 중복 실행 안 함. 커밋·push·PR·이슈 수정 0건.

## 4. 발견사항 (코드 수정 없이 보고)

**4-1 (문서 정정 권고, 차단 아님)** `docs/insights/arena-coding-unit1.md:15-16` — "미확인: reliability 계열 실재 여부"가 **사실과 불일치**.
조회 결과 뷰어 `Subset (24)` 목록에 `agent_bash_reliability (263 rows)`·`agent_bash_reliability_no_prereq (213 rows)`가 **존재한다**(카드 per-signal 나열엔 없음).
최소수정: "미확인" → "존재 확인(뷰어 24개 서브셋 목록). 다만 카드 per-signal 나열에 없고 행 스키마 미확인 → allowlist 제외(코딩 신호 아님)".
코드는 여전히 두 서브셋을 거부하므로 **동작·안전성은 불변**이며 오류 방향은 '미확인' 쪽(보수적)이다.

**4-2 (중간, 다음 단위 요구)** `src/insights/arena-coding-model.ts:18-27` — `toArenaCodingRecord`가 `rank`·`publishDate`·`ciLower/ciUpper`·`observations`를 버린다.
`Top10RecordInput`은 `rank`·`releaseDate`를 지원하므로 최소수정 = `rank`·`releaseDate(publishDate)` 매핑. 더 중요한 함정:
`arenaCodingIdentityKey`에 **publishDate가 없어서** transport가 split `full`(webdev 29.2k행)을 쓰면 동일 모델의 과거 발행 다수가 같은 키로 충돌한다.
→ transport 단위에서 `latest` split 사용을 계약으로 고정하거나 키에 publishDate를 넣어야 한다.

**4-3 (중간, 다음 단위 요구)** 숫자 컬럼은 조회상 float/int(`rating`·`score` float, `vote_count`·`observation_count` int)이며 **문자열 아님** → 파서의 `typeof v === 'number'` 요구는 원문과 정합.
다만 stringified number가 들어오면 `parseArenaCodingRow`는 **무음으로 행을 버린다**(실측: `rating:'63.31'` → undefined). transport 단위에서 타입 불일치 시 조용한 0건이 아닌 진단을 낼 것.

**4-4 (경미, 잔여 위험)** `src/insights/arena-coding-parser.ts:22-36` — 괄호 2그룹 입력에서 base id가 깨진다.
최소재현: `toBaseId('Model (20260813) (High)')` → `'model-(20260813)'`(괄호·날짜가 base에 잔류, qualifier 미분리), `parseEffortToken`은 `{effort:'high'}`만 반환.
`toBaseId('Claude Opus 4.6 (Thinking)')` → 행 전체 폐기(정책 effort 밖 접미사). 실데이터 50개 표본에는 두 형태 모두 없으나(실데이터는 'DeepSeek-V4-Pro (High, 20260813)' 단일 괄호 형태), webdev 행은 미직접 확인이다. 확인되면 최소수정 = 접미사 괄호 전부 제거 + qualifier 분리.

**4-5 (경미)** `src/insights/arena-coding-model.ts:36` — `effortQualifier`이 빈 문자열이면 키가 `…|high|`(없으면 `…|high|-`)로 갈린다. 파서는 빈 qualifier를 만들지 않으나 호출자가 ''를 넣을 수 있어 `?? '-'` → `|| '-'` 정규화 권고.

**4-6 (경미)** `src/insights/arena-coding-types.ts:3` — "기존 overall(`arena`)"은 저장소/데이터셋 어디에도 없는 이름이다(레포의 `InsightSource` = artificial-analysis·openrouter·cognition·opencode-data, 데이터셋 subset 명에도 `arena` 없음).
최소수정: "기존 overall 계통과 분리"로 표현 정리. **신규 source id가 `InsightSource`에 섞이지 않은 것(분리 요건 자체)은 PASS**.

**4-7 (경미)** `src/insights/arena-coding-model.ts:8` — `ARENA_CODING_SOURCE_ID: string`이 리터럴 타입을 넓힌다. `typeof ARENA_CODING_SOURCE` 유지 권고(동작 영향 없음).

## 5. 리뷰 한계

- 조회 1회(2026-10-20) 기준이다. per-signal bash 서브셋의 실제 행은 미조회(스키마 추론 잔존) — 4-1·4-3과 함께 transport 단위에서 실행 검증해야 한다.
- 실데이터는 agent 'latest' 스니펫의 model_name 50개로 id 매핑만 확인했고, webdev 행·full split은 미조회다.
- 레터·once·DB 미연결 상태라 후보 편입·지표 가중치·회귀 영향은 판정 범위 밖이다(§4-2가 그 전제 조건).
- CI 감사(procfs) 원인은 이번 단위 범위 밖이며, 직접 재현하지 않았으므로 원인으로 확정하지 않는다.
