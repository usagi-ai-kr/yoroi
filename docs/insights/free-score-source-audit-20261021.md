# Free 점수 소스 감사 (2026-10-21, w3) — 진단·보존 경로·재현 한계

- 범위: **진단만.** 점수·가중치·threshold·ban·무료 인증 정책 변경 없음, 코드 수정·외부 쓰기·실계정/모델/공급자 API 호출 0건, Free 실측 금지.
- 대상: #225 Free 표에서 DeepSeek/GLM/MiMo 행의 `AA 지수 = -`, `오케/워커 = ✗` 의 원인.

## 1. 확보한 증거(공개·읽기 전용)

| 자료 | 경로 | 결과 |
| --- | --- | --- |
| 발행된 레터 #225(공개) | `gh issue view 225` 댓글 2(워커 Top15)·댓글 3(Free 티어) | 일반 경로: deepseek-v4-1-flash **64.4(max)** · mimo-v2-6-flash 54.5(default) · glm-5-3-flash 53.2(default). Free 표: 3계열 모두 `✗ | ✗ | -` (AA 지수 '-'), 단 **minimax-m3-1-flash 는 `✓ 68.0 | ✓ 50.0 | 42.7`** → Free 경로가 AA 지수를 못 나르는 것이 아니라 **해당 모델의 AA 지수가 그 실행의 입력에 없음** |
| 로컬 공개 benchmark 저장소 | `~/.local/share/yoroi/yoroi.db` (insight_history) | `artificial_analysis%` 행 **0건**(전 publication_date) → 로컬 실행은 AA 수집 결과가 없음. 2026-10-20 행은 `arena_coding_*` 만 존재 |
| Actions 실행 로그 | run `39448857323` (2026-10-20T15:29Z = 00:29 KST, #225 발행 추정) | 소스별 record count·부분 수집 표기가 **로그에 없음**(설치 단계 출력만 확인) → 실행 당시 input.records 스냅샷 미보존 |
| 워크플로 | `.github/workflows/letter-publish.yml` | 러너 컨테이너 비영속 → 실행 DB 는 그 실행에서만 존재(문서 §4) |

## 2. 판정

1. **점수가 숨겨진 단계는 확정**: Free 칸의 `✗`은 `freeCell`이 `passed=false`일 때 점수를 숨기는 경로다.
   `✗`의 원인은 해당 역할 목록에서 **belowZone(원시 AA 값 컷)** 으로 빠진 것이며, `AA 지수 = -` 는 **indexText 부재(=그 실행 입력에 AA 지수 레코드 없음)** 다.
2. **Free 경로 자체는 AA 지수를 전달한다**: minimax 행이 `42.7` 로 나왔다는 사실이 그 증거다 → Free 전용 전달 결함이 아니다.
3. **원인은 입력 단계에 있다**: 그 실행의 `input.records`에 deepseek/glm/mimo 의 AA 지수 레코드가 없었고, 가격·사용량·속도 근거로 **합성 표시 점수**만 생겼다.
   w1 진단("원시값 미확인, 탈락 위치는 원값 컷 또는 indexMissing — 둘 중 하나, 단정 불가")과 **일치**한다.
4. **원인은 단정하지 않는다**: 후보는 (a) 그 실행의 AA 수집이 해당 모델군에서 빠짐(부분 수집·페이지네이션), (b) id/alias·effort 변형 매칭이 그 모델군에서만 어긋남(base/effort dedupe 또는 freeCatalog-only 경로의 alias 해석) — 둘 다 **공개 자료로 분리 불가**(아래 §3).
   원시 점수 컷과 최종 합성 점수 컷을 혼동하지 않는다: `64.4` 같은 값은 **합성 표시 점수**이며 원시 AA 값이 아니다.

## 3. 재현 한계(정확한 보존 경로)

- **재현 가능**: 코드 경로(합성 fixture)로는 "AA 지수 레코드 부재 → indexMissing → belowZone 강제 + indexText '-'" 재현 ✓ (w1 결과와 동일).
- **재현 불가**: 그 실행의 실제 AA 입력. 사유: ① 러너 DB 비영속(실행 소멸) ② Actions 로그에 소스별 record count 없음 ③ 로컬 DB는 AA 행 자체가 없음(로컬 환경 수집 결과 부재).
- **향후 보존 경로(제안)**: 발행 실행에서 **소스별 수집 건수 + AA 지수 모델 목록(개수만)** 을 로그·이슈 댓글로 남기면, 다음 발생 때 (a)/(b) 를 1회 조회로 분리할 수 있다. 비밀값·개인 사용량 원본은 포함하지 않는다(공개 benchmark 지표만).

## 4. 검사한 코드 위치(참고)

- Free 칸 점수 은폐: `src/insights/letter-markdown-free-table.ts` `freeCell`(passed=false → 점수 숨김).
- Free 행 구성: `src/insights/letter-markdown-free-sort.ts` `freeRowsFrom`(역할 목록 + free 접근 근거 행).
- AA 지수 표기: `src/insights/letter-top10-unified.ts` `indexText`(=AA 지수, 결측 시 '-').
- 원시 AA 컷: `src/insights/letter-top10-score.ts` / `letter-top10-worker.ts`(`belowZone`, worker 원값 하한 33).
- free-access placeholder: `letter-top10-unified.ts` `FREE_ACCESS_METRIC` 행(value 0, 점수 아님) · 변형 dedupe: `letter-top10-candidates.ts` `dedupeRecords` · alias 해석: `buildCatalogAliasResolver`.

## 5. 다음 구현 단위 제안(진단 결과 기반, 일반화)

- 목표: "Free 행 AA 지수 '-' 의 원인"을 **다음 실행에서 자동 판별** 가능하게 한다(점수·기준 변경 없음).
- 소유 후보: `src/insights/run-once.ts`(수집 manifest: 소스별 record count·AA 지수 모델 수 — 공개 지표만),
  `src/insights/letter-markdown-free-table.ts`(AA 결측 사유를 표기 없이 **진단 필드**로만 전달) 또는 `src/composition/insights-cli.ts`,
  테스트: 수집 manifest 단위 테스트 + Free 행 AA 결측 경로 회귀(점수·셀 출력 불변).
- 금지: 모델별 하드코드·가짜 점수, 기준 완화, Free 실측, 개인 사용량 원본 조회·출력.
- 남은 판단 필요: (a) AA 수집 누락 vs (b) id/alias·effort 변형 매칭 불일치 중 무엇을 우선 추적할지(사용자 지정 필요).
