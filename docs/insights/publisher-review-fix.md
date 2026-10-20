# 발행 복구 방어 수정 (w1, 2026-10-20)

독립 리뷰 방어 공백 2건(F1·F2)을 최소 수정으로 닫는다. 원격 쓰기 없음.

## F1 — create URL repo 검증

- `extractIssueUrlAndNumber` 결과의 repo를 `isCanonicalOrRedirectRepo`로
  확인한 뒤 번호를 쓴다. 타 repo·비github·이상 출력은 거부한다.
  canonical `qus0in/yoroi`와 redirect `usagi-ai-kr/yoroi`는 통과한다.
  raw stdout·stderr는 마스킹 후 로그에만 둔다.

## F2 — 복구 전 본문 일치 게이트

- 복구에 렌더 본문을 함께 넘겨 기존 본문과 정확 일치할 때만 보충한다.
  불일치·조회 실패는 거부하고 이슈를 open으로 남긴다.
- 누락 판정은 개수 대신 본문 완전 일치로 한다. 무관한 기존 댓글은
  건너뛰지 않고, 같은 본문은 중복 게시하지 않으며, 기대 순서대로 게시한다.
- `publish.ts`의 기존 이슈 `count >= 3` 조기 스킵을 없앴다(조회 실패만
  스킵). 순서·close 조건은 그대로다.

## 검증

- 합성 회귀 9/9 (기존 4 + 경계 5: 타repo·비github·복수이상·본문불일치·
  무관댓글). `pnpm run check` 전체는 백그라운드 실행, 원 exit 보존.
- `typecheck`·`validate-repo.py`·`diff --check` clean.
  파일 71/82/64/93/77줄(≤100). 커밋·원격·실모델·시크릿 없음.
