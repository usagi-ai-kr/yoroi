# Muse Spark Open 공개 데이터 근거 조사 (w1, #167)

- 대상: `muse-spark-open` / `muse-spark-open:cloud`(Ollama Cloud Pro). 조회일 2026-10-16.
- 방식: 공식 공개 페이지·공개 목록 직접 조회만(검색엔진 결과 의존 0건). 키·계정·env·DB·요금 API 호출 없음.
- 범위: 소스·설정·테스트는 읽기 전용. w3 구현(`plan-catalog.ts:75-76`, `model-aliases.ts:19-20`, `tests/insights-ollama-muse-open.test.ts`)은 관찰만 하고 수정하지 않는다.

## 1. 확인됨 (직접 조회, 2026-10-16)

- AA 공식 모델 페이지 직접 확인: https://artificialanalysis.ai/models/muse-spark-open
  - 페이지 표기 `Muse Spark Open (Xhigh)` · Meta · open weights · 공개 2026-10-15. 슬러그가 `muse-spark-open`이다.
  - 스펙·가격·라이선스 표기가 Ollama library(w3 기록)와 일치: 816B/42B · 1M 문맥 · $1.25/$4.25(1M) · Muse Model License · HF `meta-models/Muse-Spark-Open-816B-A42B`.
  - AA Intelligence Index 39 · 102.0 t/s · $0.84/task 표기. 서빙 4곳(Baseten·Together AI·Fireworks·Nebius) — AA provider 목록에 Ollama·OpenRouter는 없다.
  - 이 수치는 공식 페이지 표기 기록용이며 레코드로 주입하지 않는다(가짜·보간 금지).
- OpenRouter 공개 모델 목록(공식·비인증 1회, 465행): `meta/muse-spark-open`("Meta: Muse Spark Open", 1M·$1.25/$4.25) 존재.
  - 같은 목록에 `meta/muse-spark-1.3`, `meta/muse-spark-1.3-contributor`, `meta/muse-spark-1.2(contributor)`, `meta/muse-spark-1.1`, `meta/muse-wonder`, `meta/muse-glimmer-30b`가 별도 ID로 존재 → Open과 1.3은 공개 목록상 분리 ID다.
- OpenCode Data 공개 JSON 직접 확인(https://opencode.ai/data/index.json, updatedAt 2026-10-16T04:05:09Z): 모델 키 10종 중 muse·spark 키는 `muse-spark-1.3-contributor`뿐. `muse-spark-open` 키 없음.
- Cognition FrontierCode data.json 직접 확인: models 목록(v1 15·v1_1 46)에 muse/spark 행 없음.
- 레포 공개물(읽기 전용): 커밋된 `tests/fixtures/insights/*`는 전부 합성 행이고 `muse-spark-open` 0건. docs 보고·테스트도 `muse-spark-1-3` 계열만 다룬다. 비커밋 scratch에도 Open 행 0건(1.3 계열만).

## 2. 없음(조회범위) / 미확인

- AA 데이터 API(free tier, `YOROI_AA_API_KEY` 필요)·OpenRouter 일일 사용량 dataset(bearer 필요)은 호출 금지라 조회하지 않았다 → 해당 소스 레코드의 수집 여부는 미확인.
- 로컬 수집 DB는 접근 금지 → 현재 DB에 `muse-spark-open` 행이 있는지 미확인.
- OCD·Cognition의 "없음"은 각 공개 목록 조회 시점 기준이다(추가 지연 가능성 배제 불가). OR dataset의 실제 permaslug 표기(스냅샷 접미사)도 미확인.

## 3. ID 연결 분석 (정규화 기준)

- OR `meta/muse-spark-open` → `normalizeModelName` → `muse-spark-open`(카탈로그 canonical과 동일 — 별칭 불필요). AA 슬러그·OCD 키(추가 시)도 같은 형태다.
- permaslug에 날짜 스냅샷이 붙어도 `model-id.ts:11-15`가 제거한다(`-YYYYMMDD` 등). `muse-spark-1-3`과 연결하는 별칭은 제안하지 않는다(공개 목록이 분리 ID, #167 조건).
- `muse-spark-open:cloud`는 normalize가 유지하므로 canonical 도달에 별칭이 필요하며, w3가 `:cloud`→base 1건을 이미 추가했다(`model-aliases.ts:19-20`).

## 4. 카탈로그 등록 ≠ Top10 (AA 결측 시 경로)

- 후보 풀은 카탈로그 `accessible` + 레코드가 필요하다. 행이 없으면 등록만으로는 풀 진입이 불가하다(`letter-top10-candidates.ts:49-65`; `tests/insights-ollama-muse-open.test.ts`가 이 동작을 고정한다).
- AA 결측이라도 OR `total_tokens`>0 또는 OCD `opencode_data_tokens`>0 행이 있으면 풀에 유지되고 value 0 `indexMissing` placeholder가 된다(`top10-policy.ts:7`; `candidates.ts:54-55,68-87`).
- 오케스트레이터: 성능 하한이 없다(`letter-top10-score-policy.ts:42`) → 자격 가능. 점수는 0.70×성능(0)+0.05×사용량(OR/OCD log min-max)+0.10×속도(0)+0.15×가성비(0)이고, 존 컷(최고×0.85) 미달 시 ▽ 보충권에서 점수순이다(`letter-top10-score.ts:70,83-90`). 기존 실측에서도 AA 결측 근거 후보는 Top10에 진입하지 않았다(`top10-unmeasured-evidence.md:21-25`).
- 워커: AA intelligence 원값 ≥33이 필수다(`letter-top10-score-policy.ts:39`; `score.ts:83-85`) → AA 결측이면 OR/OCD가 있어도 워커 목록 자격이 없다. OR/OCD는 AA 보유 모델의 사용량·가산 입력일 뿐이다.
- 결론: `muse-spark-open`의 Top10 노출은 (a) AA 수집 행이 들어올 때가 가장 직접적인 경로(수집 여부는 미확인), (b) AA 결측이면 오케스트레이터 한정의 얇은 근거 경로뿐이다. 어느 쪽도 카탈로그 등록만으로 보장되지 않는다.

## 5. 준수와 후속

- 외부 조회: AA 페이지 3회·OR 공개 목록 1회·Cog data.json 1회·OCD index.json 1회 — 전부 공식·비인증·단발이며 실계정/요금/키 호출 0건. pull·서빙·Git/GH 변이·커밋 없음.
- 산출: 이 문서 1건(소유). 후속 판단(이슈 기록·리뷰·PR 등)은 메신저 지시 대기.
