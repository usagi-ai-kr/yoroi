# 10/20 레터 진단 — 상세 점수 누락 + MiniMax M3.1 Flash 미반영 (2026-10-20)

- 담당 w3(w18:p4). 소유: 이 문서만. **수정 0건** (제품 파일 읽기만, 원격 쓰기·커밋 없음, 실모델·시크릿·개인사용량 조회 없음).
- 대상 사용자 문제 2건: ① 10/20 레터 #192에 오케스트레이터·워커 모델별 상세 점수 없음 ② MiniMax M3.1 Flash 신규출시 미반영.

## 1. 문제 ① — #192 상세 점수(댓글 3) 누락: 원인 확정

**원인**: 발행은 본문 생성까지 성공했고, **댓글 3게시 직전** gh 출력의 URL 파싱이 실패해 종료됐다.

- 증거 1 — pm2 오류 로그(`~/.pm2/logs/yoroi-letter-error-4.log`): `2026-10-20T09:00:07: insights publish: issue creation failed`.
  9:00:03 수집 진단 → 9:00:07 실패(4초). **이슈는 이미 만들어진 뒤** 실패한 것이다.
- 증거 2 — 원격 조회: #192 `createdAt 2026-10-20T00:00:07Z`(=KST 09:00:07)·author qus0in·**comments 0**·state OPEN. 본문은 3638바이트로 정상(오케 Top7·워커 Top7 포함).
- 증거 3 — 비교: 10/19 #187은 본문+댓글 3(오케스트레이터 Top15·워커 Top15·Free 티어) 정상. 10/20만 댓글 0.
- 코드 경로(`src/composition/insights-publish.ts:77-86`): `gh issue create` 후 `created?.match(/https:\/\/github\.com\/qus0in\/yoroi\/issues\/(\d+)/)` →
  불일치 시 `fail(env,'issue creation failed')`로 **댓글 게시 전에 반환**. 메시지는 "생성 실패"지만 실제로는 **생성 성공·URL 파싱 실패**를 뜻한다(오도 문구).

**하위 결함 3건**
1. 생성 성공/URL 파싱 실패를 구분하지 않는다(로그에 gh stdout·stderr를 남기지 않는다) → 원인 특정 불가.
2. 부분 발행(본문만·이슈 open) 상태에 복구 경로가 없다.
3. 같은 날 재실행은 중복 검사에서 `skip: already published #192`로 끝나 **댓글을 게시할 수 없다** → 오늘 다시 돌려도 자동 복구 불가.

**복원 가능 여부: 가능 — 임의 재계산 아님(재렌더)**
- 로컬 저장소에 10/20 수집분이 남아 있다: `~/.local/share/yoroi/yoroi.db` → `insight_daily`에 2026-10-20 4소스
  (artificial-analysis 5536·cognition 1464·opencode-data 560·openrouter 1530), `insight_history` 2026-10-20 2090행.
- `src/insights/run-once.ts`는 저장된 성공분을 재사용한다(`--refresh`가 아니면 재수집 없음) → **같은 10/20 데이터로 댓글 3개를 재렌더 가능**(= 재계산이 아니라 재생성).
  전일 비교선도 `insight_history`의 2026-10-19/18/17분(각 116·116·61행)이라 변동(▲n) 표기가 복원된다.
- 금지: 오늘(10/20 이후) 새로 수집한 값으로 10/20 점수를 대체 게시하지 말 것. 당일 스냅샷이 남아 있으므로 **저장분 재렌더**가 유일하게 정당한 경로다.

**변경 필요 파일(다음 패킷)**
- `src/composition/insights-publish.ts` — (a) URL 파싱 실패를 "생성 성공·파싱 실패"로 구분하고 gh stdout/stderr 요약을 로그(민감정보 제외), (b) 부분 발행 복구 경로(기존 이슈에 댓글만 게시), (c) 댓글 게시 실패 시 issue를 open으로 남기는 현재 계약 유지 + 사전 검증.
- `src/ui/cli/insights-args.ts`·`insights-command.ts` — 복구용 1회성 경로(예: 기존 letter 이슈에 누락 댓글 게시). 계약은 총괄 승인 필요.
- `docs/insights/letter-issue.md` — 게시 계약(본문+댓글 3) 실패 시 복구 절차 기록.

## 2. 문제 ② — MiniMax M3.1 Flash 미반영: 원인 확정(데이터는 있었음)

**원인**: 근거 데이터는 10/20에 이미 수집돼 있었으나, **catalog에 항목이 없어 후보풀에서 제외**됐다.
- `src/insights/letter-top10-candidates.ts:51-53`의 `accessible` 집합은 `PLAN_CATALOG`의 `verified === true` 항목으로만 구성된다.
  `src/insights/plan-catalog.ts`의 opencode-go-plus 계획에는 `minimax-m3`·`minimax-m2-7`·`space-bunny`만 있고 `minimax-m3-1-flash`가 없다 → 10/20 AA 지수·가격·속도 행이 있어도 레터에 반영되지 않는다.
- 당일 저장 데이터 확인: AA 2026-10-20에 `minimax-m3-1-flash`의 `artificial_analysis_intelligence_index`·`price_1m_input/output/cache_hit`·`median_output_tokens_per_second`·`intelligence_index_total_cost`·`cost_per_task` 행 존재. opencode-data에 `minimax-m3.1-flash` 토큰 행, openrouter에 `minimax/minimax-m3.1-flash-20261019:free` 행 존재.

**공식 근거(직접 조회 2026-10-20)**
- MiniMax 공식 블로그 https://www.minimax.io/blog/minimax-m31f — 2026-10-19 "M3.1 Flash" 정식 롤아웃. "Space Bunny 🐰 … was an early version of MiniMax M3.1 Flash"(익명·초기 버전) → **Space Bunny는 M3.1 Flash의 초기 버전**이며 별개 id로 유지해야 한다(자동 병합 금지).
  제공 경로는 "MiniMax API, M Plan, MiniMax Code"로 명시 — **사용자 보유 계획(OpenCode Go/Go Plus 등) 언급 없음** → 이 근거만으로 다른 계획을 verified 처리할 수 없다.
- OpenCode Go 공식 문서 https://opencode.ai/v2/docs/console/go — Go/Go Plus 모델 목록에 **"MiniMax M3.1 Flash Free" (limited time)**, Model ID `minimax-m3.1-flash-free`,
  엔드포인트 `https://opencode.ai/inference/go/openai/v1/chat/completions`, 가격 Free·월 한도 Unlimited, "Free for a limited time" · 가용성·가격표 양쪽에 등재 → **사용자 보유 계획(OpenCode Go Plus)에서 실제 제공은 확인됨**.

**구분(반드시 유지)**
- **안정/한정**: OpenCode 쪽 표기는 "Free (limited time)" — 유료·정식 제공이 아니라 **무료 한정 제공**이다. `free: true` 표기와 한정 표기를 함께 기록한다.
- **제공자 범위**: 확인된 것은 OpenCode Go·Go Plus뿐. ChatGPT Plus·Claude Pro·Google AI Pro·Ollama Cloud·Antigravity·Cursor·SuperGrok에는 근거가 없다 → 해당 계획에 추가 금지.
- **벤치마크 동일성**: OpenCode 모델 id `minimax-m3.1-flash-free` → 정규화하면 `minimax-m3-1-flash-free`인데 AA 정규화 id는 `minimax-m3-1-flash`다(접미 `-free` 불일치). **명시 alias 필요**(기존 `muse-spark-1-3-contributor`→`muse-spark-1-3` 선례), 유사명 자동 병합 금지.
- **Space Bunny**: `space-bunny`(OpenRouter `stealth/space-bunny-alpha`)는 M3.1 Flash의 초기 버전이지만 별개 모델로 유지. blog 근거는 "초기 버전" 관계만 준다.

**변경 필요 파일(다음 패킷)**
- `src/insights/plan-catalog.ts` — opencode-go-plus(또는 go) 계획에 `MiniMax M3.1 Flash Free` 항목 추가: `modelId: minimax-m3-1-flash-free`, `displayName: 'MiniMax M3.1 Flash Free'`,
  `sourceUrl: https://opencode.ai/v2/docs/console/go`, `checkedOn: 2026-10-20`, `verified: true`, `free: true`, `note: 'OpenCode Go/Go Plus · Free(limited time)'`.
- `src/insights/model-aliases.ts` — `minimax-m3-1-flash-free` → `minimax-m3-1-flash` 명시 alias(basis: OpenCode Go 모델 id와 AA 정규화 id의 접미 차이, sourceUrl·checkedOn 필수).
- `src/insights/plan-catalog.ts`의 `space-bunny` 항목 note — M3.1 Flash 초기 버전 관계만 표기(병합·대체 아님).
- Free 티어 표기·무료 전용 판정(`letter-top10-plans.ts`의 `freeOnlyModelIds`) 결과는 회귀 확인 필요.

## 3. 누가 무엇을 할지(다음 패킷 소유 제안)

| 담당 | 작업 | 산출 |
| --- | --- | --- |
| 총괄(승인) | 복구 경로 계약·댓글 게시 1회성 명령 승인, #192 댓글 게시 승인 | 승인 기록 |
| 구현 A | publisher URL 파싱 실패 구분·로그·부분 발행 복구 | `src/composition/insights-publish.ts` + 테스트 |
| 구현 B | catalog 항목 + 명시 alias + Free 표기 | `plan-catalog.ts`·`model-aliases.ts` + 테스트 |
| 총괄(게시) | 10/20 저장분 재렌더 → #192에 댓글 3 게시(당일 데이터·임의 재계산 금지) | 원격 쓰기 |
| 검증 | 레터 Top7·댓글 Top15 재현 일치·Free 티어·기존 회귀 | 집중 테스트 + 전체 check |

## 4. 미확인·주의

- gh가 왜 URL 파싱에 실패했는지는 **현재 로그로 특정 불가**(stdout 미보존). 10/20에만 발생했고 10/13~10/19 발행은 정상 → 일시적·환경 요인으로 추정하며 확정하지 않는다.
- 10/20 본문은 정상 발행되어 있으므로 **본문 재게시는 불필요**하고 댓글 3만 게시하면 된다.
- `minimax-m3-1-flash-free`를 MiniMax·OpenCode 어느 쪽 id로 표기할지는 alias 정리의 선택이며, 두 제공자를 모두 verified 처리하는 근거는 없다.
- 문제 ① 복구 시 `insights once`가 캐시를 재사용하는지(--refresh 없이) 실행 로그로 확인 후 진행한다. 재수집이 일어나면 당일 스냅샷 보존이 깨지므로 중단한다.
