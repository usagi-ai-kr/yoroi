# AI 인사이트 레터 이슈 발행 계약 ([#94](https://github.com/qus0in/yoroi/issues/94), [#105](https://github.com/qus0in/yoroi/issues/105))

매일 인사이트 레터를 yoroi 레포(private) 이슈로 발행하는 yoroi CLI 계약이다.
이전 Hermes 발행 경로와 전환 시각은 아래 발행 주체 이력에 보존한다.

## 역할 분리 및 실행 명령

- **본문 미리보기 명령**: `yoroi insights once --markdown`
  - GitHub 이슈 본문용 마크다운 레이아웃(배지·테이블·이모지·details)을 stdout으로 출력한다.
  - 터미널용 텍스트는 `--pretty`, 기존 전량 상세 출력은 `--full` 플래그로 유지한다.
- **이전 발행 주체**: 코테츠(Hermes)가 매일 cron 실행, 이슈 게시·중복 방지·전일 레터 close, 실패 알림 및 통보를 담당했다(2026-10-13 PM2로 이관).
- **현행 발행 명령**: `yoroi insights publish [--dry-run] [--not-before HH:MM]`. PM2가 실행하며 본문은 `once --markdown`과 같은 renderer를 쓴다.

## 발행 계약

- **주기**: 매일 1회 09:00 KST. 같은 KST 날짜에는 1건만 생성한다.
- **시각 가드**: 기본 09:00 KST 전에는 `skip: before 09:00 KST`를 출력하고 종료한다. `--not-before HH:MM`으로 기준 시각을 바꿀 수 있다.
- **제목**: `[letter] YYYY-MM-DD AI 인사이트 레터` (KST 날짜 기준).
- **라벨**: `letter` 만 부여한다. `memo`, `work` 등 작업 라벨은 붙이지 않는다.
- **마크다운 본문 구성 (`--markdown`)**:
  - **헤더 & 배지**: `# AI 인사이트 데일리: YYYY-MM-DD KST` 제목 및 shields.io 정적 배지:
    - 날짜 배지: `![date](https://img.shields.io/badge/date-YYYY--MM--DD-blue)` (`--` 이스케이프)
    - 소스 수 배지: `![sources](https://img.shields.io/badge/sources-4_total-informational)` (`INSIGHT_SOURCES` 레지스트리 기준)
    - Arena 제외(2026-10-13 사용자 결정): 수집·출처·참조 순위('Arena N위')에서 빠져 소스 수가 5에서 4로 줄었다.
    - 상태 배지: `![status](https://img.shields.io/badge/status-all_healthy-success)` (실패 시 `N_failed-critical`, 부분 수집 시 `N_partial-warning`)
  - **1부 요약**: 두 목록의 선두 모델과 목록별 상위권 변동(➖·▲N/▼N·🆕 진입·🌱 첫 집계)·이탈(🚪) 통계.
  - **2부 🧭 오케스트레이터 Top 10** (판단·계획 / Intelligence Index): 마크다운 테이블.
  - **3부 🛠️ 워커 Top 10** (실행·코딩 / Coding Index): 마크다운 테이블.
  - **테이블 열 규격** (두 섹션 공통 · `추천 역할` 열은 두 목록 분리로 폐기, `가성비` 열은 2026-10-13 종합 스코어 도입으로 `스코어` 열로 대체):
    `| 순위 | 모델 | 추천 effort | 스코어 | 지수 | 혼합 단가 | 변동 |`
    - 모델: 후보 풀(요금제 접근·제외·최신만)을 두 목록이 공유하므로 교집합 모델은 `↔`를 붙여 양쪽에 함께 오른다.
    - 순위: 파레토 최적 시 `⭐ 순위` (예: `⭐ 1`), 비파레토는 일반 숫자. 임계 미달 보충 행은 `▽ 순위` (예: `▽ 9`).
    - 변동: `➖` 유지, `▲N`/`▼N` 전일 대비 순위 상승/하락, `🆕` 신규 진입(전일 Top10 밖), `🌱` 첫 집계(전일 기록 없음).
    - 테이블 하단: 이탈 목록 (`🚪 이탈: 모델명 (전일 N위)`).
    - 접근 요금제: Top10 열에서 분리해 워커 표 뒤 별도 `## 접근 요금제` 표로 표시한다(2026-10-13 사용자 지시: "별도 테이블로 체크박스"). 두 목록(오케스트레이터·워커) unique 모델 × 보유 요금제 합집합(plan-catalog 순서)을 `☑`/`☐`로 채우고, 행이 없으면 표를 생략한다.
    - Free 티어: 유료 표와 섞이지 않는 `## 🆓 Free 티어` 별도 섹션이다. 목록은 실시간 free 카탈로그로 채우고 비면 `Free 목록 수집 실패(opencode models)` 1줄만 표시하며, 티어 설명은 Zen Free·Go Free 두 줄이다.
  - **4부 표시 안내**: 두 Top10 표 바로 아래 `## 📖 표시 안내`로 ⭐·↔·➖/▲N/▼N/🆕/🌱/🚪·▽ 하한 보충·지수 미측정·⚠️·🔒·🆓 의미를 한곳에 설명한다(접힘 블록 밖, 마크다운·압축 렌더 공통).
  - **5부 접힘 블록**: `<details><summary>출처 및 산출 공식</summary>...`
    - 산출 공식 및 정책: 두 목록 진입 조건(오케스트레이터 지수 ≥ 후보 최고 85% · 워커 코딩 ≥ 75% + 보유 요금제 접근), 가성비 최적 존 임계는 자격 필터, 혼합 단가 `(3×입력+출력)/4`, 스코어 = 100 × Σ(가중치 × 정규화값) 내림차순(동점 시 지수), 정규화(min-max·log10·결측 규칙), 추천 effort는 변형별 실효 단가 스코어링, default는 AA에 effort 변형 또는 cost_per_task가 없어 단일 구성으로 평가, 정렬 및 제외 규칙.
    - 실패 소스 안내: 정상 시 `모든 소스 정상 수집 완료`, 실패 시 `⚠️ 소스명`, 부분 수집(일부 행 거절) 시 `⚠️ 부분 수집 소스: ...`가 함께 표시된다.
    - 경고: 전일 자료 부족 등 수집 경고가 있으면 `### 경고` 블록에 나열한다.
    - 출처 4사 라이선스 명시 (OpenRouter, AA, Cognition, OpenCode Data (내부 참조 · 약관상 자동 추출 제한)).
- **중복 방지 (이전 계약)**: `label:letter` 및 당일 제목 검색 시 재발행하지 않고 댓글로 남긴다.
- **중복 방지 정정 (2026-10-13)**: 오늘 제목이 open/closed `label:letter` 이슈에 있으면 댓글 없이 `skip: already published #N`을 출력하고 종료한다.
- **종료 코드**: `0` 정상, `1` 실패(이슈 미게시, 알림 발송), `2` 인자/설정 오류.
- **전일 close (이전 계약)**: 새 레터 게시 직후 전일 `letter` 이슈를 close한다 (열린 레터 최신 1건).
- **전일 close 정정 (2026-10-13)**: 생성 성공 후 새 이슈를 제외한 open `letter` 이슈 모두에 후속 레터 댓글을 단 뒤 close한다.
- **Dry-run**: GitHub 쓰기 없이 제목·중복 판정·close 대상만 표시한다. 수집·렌더 실패는 이슈를 만들지 않고 exit 1이다.
- **출력 및 보안**: 성공 stdout은 `published #N <url> <KST 시각>` 한 줄이다. 인증값과 본문 원문은 로그에 출력하지 않는다.
- **공개 범위**: private 전제. Cognition·AA 포함으로 public 전환 시 발행 즉시 중단.
- **발행 시 사용자 통보**: 이슈 번호·링크·KST 시각을 사용자에게 통보한다.

## 마크다운 본문 예시

```markdown
# AI 인사이트 데일리: 2026-10-12 KST
![date](https://img.shields.io/badge/date-2026--10--12-blue)
![sources](https://img.shields.io/badge/sources-5_total-informational)
![status](https://img.shields.io/badge/status-all_healthy-success)

## 🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)
| 순위 | 모델 | 추천 effort | 스코어 | 지수 | 혼합 단가 | 변동 |
| --- | --- | --- | --- | --- | --- | --- |
| ⭐ 1 | anthropic/claude-3-7-sonnet ↔ | high | 78.4 | 85.2 | $3.75 | ➖ |
| ▽ 9 | provider/fill-model | default | 40.1 | - | $1.50 | 🆕 |

## 📖 표시 안내
- ⭐ 파레토 최적: 더 싸고 더 좋은 모델이 없는 상태(가성비 경계선)
- ↔ 양쪽 목록 교집합: 오케스트레이터·워커 두 목록 모두에 오른 모델
- ▲N / ▼N 전일 대비 순위 상승/하락, ➖ 유지, 🆕 신규 진입(전일 Top10 밖), 🌱 첫 집계(전일 기록 없음), 🚪 이탈
- ▽ 하한 보충: 임계(오케 85%/워커 75%) 미달이지만 10개를 채우려 지수 순으로 넣은 모델
- 지수 미측정(AA에 해당 역할 지수 없음, 지수 항목 0점)
- ⚠️ 한도·주의(추정 한도, 실측 제약 등), 🔒 접근 제한(지역·조건), 🆓 무료

<details><summary>출처 및 산출 공식</summary>...</details>
```

## 본문 65,536자 초과 시 처리 규칙 (GitHub 이슈 본문 한도 대응)
- 기본 마크다운 및 압축 형식은 한도를 넘지 않는다 (샘플 기준 약 2,000자).
- 65,536자는 코드포인트 기준이다(UTF-16 코드 유닛이 아니며 서로게이트 쌍은 갈리지 않는다).
- 초과 시 표 행(줄) 경계에서 자르고 `(이하 생략 — 전체는 \`--full\`)`를 붙여 한도 이내로 맞춘다. 행 중간은 절단하지 않는다.
- 댓글 분할 게시가 필요하면 코테츠가 잘린 본문과 `--full` 출력으로 별도 게시한다(yoroi는 분할하지 않는다).

## 발행 주체·일정 (2026-10-11 사용자 제공 사실, 외부 조회 없음)
- 매일 레터 크론 이력: Hermes `yoroi-letter-daily`(job `3409ac85f368`), 매일 09:00 KST, 첫 실행 2026-10-12 09:00.
- **2026-10-13 사용자 지시로 Hermes `yoroi-letter-daily`(job `3409ac85f368`)를 삭제하고, yoroi 자체 PM2 프로세스 `yoroi-letter`(매일 09:00 KST, cron_restart, 등록·운영은 [letter-pm2.md](letter-pm2.md))로 이관했다.** 발행 명령은 `yoroi insights publish`이며 09:00 KST 이전 skip·당일 중복 skip·전일 close를 자체 수행한다.
- 별도 주간보고 크론: Hermes `yoroi-weekly-report`(job `e32c1f8f04ae`), 매주 토요일 09:00 KST, 첫 실행 2026-10-17.
- 2026-10-11 수동 첫 발행은 [#99](https://github.com/qus0in/yoroi/issues/99) 마감, 위 크론과 실행 시각이 겹치지 않는다.
