# 1.0.3 수정본 레터 프리뷰 (w3, 준비만·게시 없음)

- 렌더: `/tmp/yoroi-103-final-clean` 공식 renderer, 저장 스냅샷만 (`--refresh` 없음).
- 신규 수집·once·pull·serve 없음. 임시 DB 복사본은 렌더 후 삭제, 값·경로 미기록.
- 산출: full `/tmp/yoroi-103-letter-preview.md`, compact 별도 txt, provenance JSON.

## 1.0.2 대비 (동일 입력)

- diff 정확히 1줄: 워커 4위 deepseek `high→max`. 점수·순위·선정 불변.
- 입력 메타: 스냅샷 sha16 `2704244a…`, 렌더 06:14Z. 행 단위 동일 입력 결론.

## 구분 확인

- DeepSeek 워커 4위 59.3·AA 39.5·`max` (라벨 수정분).
- 오케 deepseek ▽9 `high` 58.0 그대로 (워커 분기만 수정).
- Argon 오케 6위 60.9·AA 52.6 (스냅샷 관측, 하드코딩 아님).
- Muse Open 미진입 (AA 38.9 컷 미달, 현재 관측 — 부재 단정 아님).

## 규격

- compact 3589자/3600·20행·가성비열·normal 50·Free fallback 문구. 전부 충족.
- 개인 usage 문자열 0건. 공개 benchmark만.

## 발행 관행·규칙 (`letter-issue.md`·#162 대조)

- #162(오늘·OPEN) 존재 → 당일 중복 skip 규칙 적용. 수동 suffix 발행이 선례.
- '수치는 issue 미기록' 규칙 범위 불명확 → 공개 benchmark 점수는 기존 발행 관행(#162 본문) 내.
- 개인 usage·env·token은 발행물에 없음. 임의 게시 없이 계획만 보고.

## 게시 계획 (Release 1.0.3·global 검증 후 필수)

- 제목 `[letter] 2026-10-16 AI 인사이트 레터 (1.0.3)`, 기존 #162 정리 후 발행.
- #165는 레터 게시 후 직접 close. 실행은 다음 패킷. 보고 후 대기.
