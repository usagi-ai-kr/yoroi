# AI 인사이트 레터 이슈 발행 계약 ([#94](https://github.com/qus0in/yoroi/issues/94), [#105](https://github.com/qus0in/yoroi/issues/105))

매일 인사이트 레터를 yoroi 레포(private) 이슈로 발행하는 코테츠(Hermes cron)와
yoroi CLI 간의 발행 계약이다.

## 역할 분리 및 실행 명령

- **크론 실행 명령**: `yoroi insights once --markdown`
  - GitHub 이슈 본문용 마크다운 레이아웃(배지·테이블·이모지·details)을 stdout으로 출력한다.
  - 터미널용 텍스트는 `--pretty`, 기존 전량 상세 출력은 `--full` 플래그로 유지한다.
- **코테츠(Hermes)**: 매일 cron 실행, 이슈 게시·중복 방지·전일 레터 close, 실패 알림 및 통보.

## 발행 계약

- **주기**: 매일 1회 09:00 KST. 같은 KST 날짜에는 1건만 생성한다.
- **제목**: `[letter] YYYY-MM-DD AI 인사이트 레터` (KST 날짜 기준).
- **라벨**: `letter` 만 부여한다. `memo`, `work` 등 작업 라벨은 붙이지 않는다.
- **마크다운 본문 구성 (`--markdown`)**:
  - **헤더 & 배지**: `# AI 인사이트 데일리: YYYY-MM-DD KST` 제목 및 shields.io 정적 배지:
    - 날짜 배지: `![date](https://img.shields.io/badge/date-YYYY--MM--DD-blue)` (`--` 이스케이프)
    - 소스 수 배지: `![sources](https://img.shields.io/badge/sources-5_total-informational)` (`INSIGHT_SOURCES` 레지스트리 기준)
    - 상태 배지: `![status](https://img.shields.io/badge/status-all_healthy-success)` (실패 시 `N_failed-critical`, 부분 수집 시 `N_partial-warning`)
  - **1부 요약**: 선두 모델 및 상위권 변동·신규·이탈 통계.
  - **2부 🧭 오케스트레이터 Top 10** (판단·계획 / Intelligence Index): 마크다운 테이블.
  - **3부 🛠️ 워커 Top 10** (실행·코딩 / Coding Index): 마크다운 테이블.
  - **테이블 열 규격**:
    `| 순위 | 모델 | 추천 effort | 지수 | 혼합 단가 | 가성비 | OR 사용량 | 변동 |`
    - 순위: 파레토 최적 시 `⭐ 순위` (예: `⭐ 1`), 비파레토는 일반 숫자.
    - 변동: `🆕 신규`, `🔼 N`, `🔽 N`, `유지` 이모지 표기.
    - 테이블 하단: 이탈 목록 (`• 이탈: 모델명 (전일 N위)`).
  - **4부 접힘 블록**: `<details><summary>출처 및 산출 공식</summary>...`
    - 산출 공식 및 정책: 가성비 최적 존(85%/75% 임계 + 가성비 순), 혼합 단가 `(3×입력+출력)/4`, 가성비 `지수/max(단가,0.01)`, 정렬 및 제외 규칙, ★ 파레토 최적.
    - 실패 소스 안내: 정상 시 `모든 소스 정상 수집 완료`, 실패 시 `⚠️ 소스명`, 부분 수집(일부 행 거절) 시 `⚠️ 부분 수집 소스: ...`가 함께 표시된다.
    - 경고: 전일 자료 부족 등 수집 경고가 있으면 `### 경고` 블록에 나열한다.
    - 출처 5사 라이선스 명시 (LMArena, OpenRouter, AA, Cognition, OpenCode Data (내부 참조 · 약관상 자동 추출 제한)).
- **중복 방지**: `label:letter` 및 당일 제목 검색 시 재발행하지 않고 댓글로 남긴다.
- **종료 코드**: `0` 정상, `1` 실패(이슈 미게시, 알림 발송), `2` 인자/설정 오류.
- **전일 close**: 새 레터 게시 직후 전일 `letter` 이슈를 close한다 (열린 레터 최신 1건).
- **공개 범위**: private 전제. Cognition·AA 포함으로 public 전환 시 발행 즉시 중단.
- **발행 시 사용자 통보**: 이슈 번호·링크·KST 시각을 사용자에게 통보한다.

## 마크다운 본문 예시

```markdown
# AI 인사이트 데일리: 2026-10-12 KST
![date](https://img.shields.io/badge/date-2026--10--12-blue)
![sources](https://img.shields.io/badge/sources-5_total-informational)
![status](https://img.shields.io/badge/status-all_healthy-success)

## 🧭 오케스트레이터 Top10 (판단·계획 / Intelligence Index)
| 순위 | 모델 | 추천 effort | 지수 | 혼합 단가 | 가성비 | OR 사용량 | 변동 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ⭐ 1 | anthropic/claude-3-7-sonnet | high | 85.2 | $3.75 | 3위 | 1위 | 유지 |

<details><summary>출처 및 산출 공식</summary>...</details>
```

## 본문 65,536자 초과 시 처리 규칙 (GitHub 이슈 본문 한도 대응)
- 기본 마크다운 및 압축 형식은 한도를 넘지 않는다 (샘플 기준 약 2,000자).
- 65,536자는 코드포인트 기준이다(UTF-16 코드 유닛이 아니며 서로게이트 쌍은 갈리지 않는다).
- 초과 시 표 행(줄) 경계에서 자르고 `(이하 생략 — 전체는 \`--full\`)`를 붙여 한도 이내로 맞춘다. 행 중간은 절단하지 않는다.
- 댓글 분할 게시가 필요하면 코테츠가 잘린 본문과 `--full` 출력으로 별도 게시한다(yoroi는 분할하지 않는다).

## 발행 주체·일정 (2026-10-11 사용자 제공 사실, 외부 조회 없음)
- 매일 레터 크론: Hermes `yoroi-letter-daily`(job `3409ac85f368`), 매일 09:00 KST, 첫 실행 2026-10-12 09:00.
- 별도 주간보고 크론: Hermes `yoroi-weekly-report`(job `e32c1f8f04ae`), 매주 토요일 09:00 KST, 첫 실행 2026-10-17.
- 2026-10-11 수동 첫 발행은 [#99](https://github.com/qus0in/yoroi/issues/99) 마감, 위 크론과 실행 시각이 겹치지 않는다.
