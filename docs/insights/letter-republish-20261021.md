# 2026-10-21 레터 재발행 기록

## 범위

- 갱신 로직(Free 리뷰어 열·검증 별칭·3역할 안내)을 main에 반영하고 같은 날짜 레터를 교체 발행했다.
- 메신저 분리(#227)는 이번 발행에 포함하지 않았다. 별도 추적 단위다.

## 커밋·CI

- dev `9d2bc56` push → PR #228 생성.
- PR CI 2건 success(`39520715710`, `39520777107`).
- PR #228 merge → main `61cdea9`(2026-10-21T00:22:33Z).
- main CI `39520972171` success(수동 dispatch, main push 트리거 없음).

## 발행

- dry-run `39521152712`: `title="[letter] 2026-10-21 AI 인사이트 레터" duplicate=yes closed_same_title=none close=#225 comments=3`, Free 가드 통과.
- #225 close(2026-10-21T00:25:28Z, 본문·댓글 이력 보존).
- 실제 발행 `39521240285`: `published #229 ... 2026-10-21 09:26 KST`.
- #225에 후속 레터 #229 링크 댓글 게시.

## 발행물 확인 (오케스트레이터 1차)

- #229 본문: 오케·리뷰어·워커·메신저 Top7 3개 표, 표시 안내, 산출 공식·출처 details.
- 댓글 3개: 오케 Top15 / 리뷰어 Top15 / 워커·메신저 Top15+Free.
- Free 표 8열: 모델·오케·리뷰어·워커·AA 지수·Zen·Go·비고.
- 별칭 4건: deepseek-v4-1-flash(리뷰어 0.74·워커 53.2), minimax(0.68·61.5), glm(0.66·✗), mimo-v2-6-flash(0.60·✗).
- 미확인 행은 `-`/✗ 유지, 비밀값 없음.
- w3 독립 검증은 `docs/insights/letter-229-verification-20261021.md`에서 진행.

## 남은 것

- #227 메신저 분리 4번째 섹션: U1 점수 모델 → U2 렌더/Free 4열 → U3 댓글 4개·발행 계약 → U4 발행.
- #226 Arena 비용·Net Improvement: 링크-only 권고, 자동 수집 없음. 도입 여부는 별도 결정.
- 버전·태그·Release 변경 없음.
