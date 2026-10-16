# 1.0.2 레터 clean preview 독립 검토 (w1, `yoroi-102-letter-review-w1`, 2026-10-16)

- 대상: `/tmp/yoroi-102-letter-clean-preview.md`(14:52, w2 clean preview). 소스: 후보 `/tmp/yoroi-102-final-clean` = 커밋 `44253ed`.
- 방식: 미리보기·후보·저장 공개 스냅샷의 **특정 metadata 행만** 확인(개인 usage 원본·DB 전체 dump 없음). 발행·Git/GH·tag/Release·global 없음. w2 소유 preview/문서는 수정하지 않음.

## 소스 고정 (필수 조건)

- 후보 47파일 sha256 = 커밋 `44253ed` blob과 **전부 일치**(불일치 0) — 이 preview의 렌더 소스는 커밋과 동일. `letter-top10-score.ts`에 `aaFallback` 부재(1.1 제외) 재확인.
- 입력 daily(2026-10-16, `insight_daily` 최신): AA(partial, 5513행, complete=0)·OpenRouter(1530)·OpenCode Data(560)·Cognition(1464). AA partial 경고가 preview 헤더 `status-1_partial-warning`과 일치.

## Argon 52.6 근거 대조 (요청)

- **AA daily 특정 행**: `gemini-4-argon`, 별칭 `Gemini 4 Argon (High)`, `artificial_analysis_intelligence_index = 52.6` ✓ — preview ▽6행(effort `high`, AA 52.6)과 ID·effort 일치.
- **OR daily 특정 행**: `google/gemini-4-argon-20261013` `total_tokens` 존재(usage 근거) — 정규화가 `-20261013` 스냅샷을 제거해 카탈로그 canonical과 일치(별칭 불필요).
- **Cognition**: `Gemini 4 Argon` v1_1 high/main `correct 0.5085` 등 존재(오케 성능 보조 근거).
- 판정: ▽6 실제 행의 AA 52.6은 공개 스냅샷 행과 일치(하드코딩 아님) — **확인됨**.

## Muse 정정 (검토 발견)

- AA daily에 **`muse-spark-open`, 별칭 `Muse Spark Open (Xhigh)`, AA Intelligence = 38.9** 행이 현 스냅샷에 **존재**한다. OR/OCD에는 없다.
- 따라서 w2 prep provenance의 "벤치마크 evidence 부재로 Top10 미진입"은 현 스냅샷 기준 **부정확** — 정확한 서술은 "AA 측정 38.9 존재, Top10은 점수 순위 미달로 미노출". 발행 본문·코멘트에서 이 표현을 그대로 쓰면 안 된다(정정 필요).
- 카탈로그 지원(verified)과 실제 Top10 유무는 별개임을 재확인 — 미노출 자체는 정상 순위 결과다.

## historical 분리

- 초기 조사(candidate-path)의 "argon AA 0·OR-only(메신저 실측)", "muse AA 없음"은 **당시 조회 시점** 사실로 한정한다. 현 스냅샷은 둘 다 AA 측정이 존재한다. 과거 문구 재사용 금지, **#160 완전 재현 주장 금지**(새 render·새 스냅샷).

## 테이블·렌더 품질

- 실제 **오케 10행 + 워커 10행 = 20행**, Free 별도 표 9행. 컬럼(성능/사용량/속도/가성비·가격, 가산, AA 지수, 혼합 단가, 변동)과 ▽·👍·범례 일관.
- 정규 표시 조건: 범례 "표시 점수=역할별 정규순위 50중심(근사), 임계·차원·순위=원점수" — 공식 절(가중치 70/5/10/15, 가성비 I/(P+.01) log, 워커 .30/.20/.10/.40+가산)과 일치.
- 스팟 대조: opus raw = 0.70×99+0.05×60+0.10×96+0.15×50 = 89.4(> 표시 72.4는 정규 표시), ▽컷 = raw max×0.85 ≈ 76 → 5~10위 ▽ 표기 정상. ▽6 argon `(90/11/42/26) 52.6` 실제 행 확인.
- 미도착: w2 clean compact(3600자 예산)·clean provenance/report — 이번 검토 범위 밖(도착 시 별도 확인).

## 발행 조건 (명시)

1. Release(main CI success·tag/Release) 후 **최종 main merge SHA**로 동일 절차 재렌더→본 preview와 일치 확인 **필수**. 불일치 시 게시 금지.
2. 이슈 기록: 기존 `letter-issue.md` 발행 계약(제목·`letter` 라벨·1일 1건·09:00 가드·본문 구성)과 발행처 관행 준수, 이슈·코멘트에 민감·개인 수치 미기록. #162 처리(신규 1.0.2 게시 후 close/댓글)는 Release 후 절차대로.
3. Muse 표현 정정(위)과 historical 문구 분리를 게시 전 반영.

## 준수

- 소유 review docs/JSON만 작성(≤100줄). Git/GH 변이·게시·tag/Release/global 0. env·개인 usage·raw 0. 보고 후 메신저 지시 대기.
